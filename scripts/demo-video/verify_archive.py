"""Check the actual demo ZIP before it is published as a public Actions artifact."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile


SCENES = [
    "01_inicio", "02_cuentas", "03_movimientos", "04_presupuestos",
    "05_periodicos", "06_compartidos", "07_deudas", "08_tesoreria",
    "09_asistente", "10_cierre",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def video(info):
    require(info["resolution"] == {"width": 1920, "height": 1080}, "Resolución incorrecta")
    require(info["durationSeconds"] > 2, "Vídeo demasiado corto")
    require(info["codec"] == "h264" and info["audioTracks"] == 0, "Se requiere H.264 sin audio")


def verify(archive):
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    expected = archive.with_suffix(".zip.sha256").read_text().split()[0]
    require(digest == expected, "El SHA-256 del ZIP no coincide")
    with zipfile.ZipFile(archive) as z:
        require(z.testzip() is None, "CRC incorrecto en el ZIP")
        names = z.namelist()
        require(len(names) == len(set(names)), "Entradas duplicadas en el ZIP")
        for name in names:
            path = PurePosixPath(name)
            require(not path.is_absolute() and ".." not in path.parts and "\\" not in name, "Ruta insegura")
            require(z.getinfo(name).file_size > 0, f"Archivo vacío: {name}")
        required = {
            "preview_sin_voz.mp4", "recording_manifest.json", "capture.json",
            "guion_locucion.md", "storyboard.md", "repetir_grabacion.md",
            "contact_sheet.jpg", "demo_backup_ficticio.json",
        }
        require(required.issubset(names), f"Faltan documentos: {required - set(names)}")
        for directory, extension in [("scenes", "mp4"), ("originals", "webm"), ("thumbnails", "png")]:
            actual = {n for n in names if n.startswith(directory + "/")}
            wanted = {f"{directory}/{scene}.{extension}" for scene in SCENES}
            require(actual == wanted, f"Faltan o sobran archivos en {directory}: {actual ^ wanted}")
        require(len([n for n in names if n.startswith("qa/") and n.endswith(".png")]) == 30, "Se requieren 30 controles")

        manifest = json.loads(z.read("recording_manifest.json"))
        require(manifest["status"] == "passed" and manifest["complete"], "Manifiesto incompleto o fallido")
        require(manifest["sceneCount"] == len(manifest["scenes"]) == 10, "Se requieren diez escenas validadas")
        require(manifest["mode"] == "record", "El lote debe ser una grabación real")
        require([s["id"] for s in manifest["scenes"]] == [f"{i:02}" for i in range(1, 11)], "Orden de escenas incorrecto")
        for scene, stem in zip(manifest["scenes"], SCENES):
            require(scene["video"]["file"] == f"scenes/{stem}.mp4", "Nombre de vídeo incorrecto")
            video(scene["video"])
            validation = scene["validation"]
            require(validation["status"] == "passed" and validation["reactRendered"] and validation["isolated"] and validation["metricsMatch"], "Escena sin validar")
            require(all(validation[k] == 0 for k in ["javascriptErrors", "externalRequests", "apiRequests"]), "Errores de navegador o tráfico externo")
            if scene["id"] not in ["03", "04", "05"]:
                require(validation["storageWrites"] == 0, "Una consulta ha escrito datos")
            require(not scene["issues"], "La escena tiene incidencias")
        video(manifest["preview"])
        require(abs(manifest["preview"]["durationSeconds"] - 175) < 0.5, "Duración del montaje incorrecta")

        inventory = manifest["files"]
        require(len(inventory) == len({f["file"] for f in inventory}), "Inventario duplicado")
        require({f["file"] for f in inventory} == set(names) - {"recording_manifest.json"}, "El inventario no corresponde al ZIP")
        for entry in inventory:
            content = z.read(entry["file"])
            require(len(content) == entry["bytes"] and hashlib.sha256(content).hexdigest() == entry["sha256"], f"Hash incorrecto: {entry['file']}")
        for name in names:
            if name.endswith((".json", ".md")):
                text = z.read(name).decode("utf-8")
                require(not re.search(r"[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}", text), f"Correo en {name}")
                require(not any(p in text for p in ["/workspace/", "/home/", "GEMINI_API_KEY", "Bearer "]), f"Dato privado en {name}")
        backup = json.loads(z.read("demo_backup_ficticio.json"))
        require(backup["version"] == "3.1", "Se requiere backup 3.1")
        require([c["name"] for c in backup["contacts"]] == ["Amistad A", "Amistad B"], "Solo se permiten contactos de la fixture")
        require(all(not c.get("phoneOrEmail") for c in backup["contacts"]), "Contacto con datos personales")
    return {
        "status": "passed", "archive": archive.name, "bytes": archive.stat().st_size,
        "sha256": digest, "sceneCount": 10, "thumbnailCount": 10, "controlFrameCount": 30,
        "previewSeconds": manifest["preview"]["durationSeconds"],
        "automationHeadAtCapture": manifest["automationHeadAtCapture"],
        "issues": [],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    result = verify(args.archive)
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
