# Mediciones de rendimiento 5G

Tres muestras por escenario y perfil; builds de producción, gzip, ejecución secuencial sin otro navegador/build/pruebas local competidor. Origen871e630 frente a fuente c6f663f. CDP no es dispositivo físico ni INP de campo. Rangos solapados no prueban una mejora ni regresión atribuible al cambio.

Perfiles:390×900 CPU4×/80ms/1,6Mbps;768×900 CPU2×/40ms/5Mbps;1280×900 CPU1×/20ms/10Mbps. Node24.22.1,Chromium156.0.8078.79,Linux,3CPU AMD EPYC9V74,10.452.459.520B RAM.

| Perfil / escenario | Antes, ms mediana [mín–máx] | Después, ms mediana [mín–máx] |
| --- | --- | --- |
| mobile/landing-es-cold | 1,548.1 [1,506.6–1,638.6] | 1,594.9 [1,540.0–1,629.9] |
| mobile/landing-en-cold | 2,247.1 [2,212.9–2,292.8] | 2,199.2 [2,185.8–2,271.8] |
| mobile/application-empty-cold | 2,759.0 [2,722.6–2,868.2] | 2,821.1 [2,775.2–2,936.9] |
| mobile/application-cold | 2,766.8 [2,744.6–2,768.1] | 2,750.8 [2,591.9–2,913.0] |
| mobile/application-warm | 794.4 [758.4–844.9] | 754.8 [751.5–802.6] |
| mobile/chart-first-open | 615.6 [546.6–644.6] | 673.6 [644.9–681.8] |
| mobile/planning-first-open | 672.6 [649.0–750.5] | 710.0 [685.4–1,070.0] |
| mobile/catalog-first-open | 1,013.5 [987.9–1,043.0] | 819.5 [730.1–1,035.7] |
| mobile/ledger-100-first-open | 860.3 [798.9–902.0] | 703.2 [682.8–809.1] |
| mobile/ledger-100-filter | 262.2 [232.8–282.7] | 248.9 [199.4–284.6] |
| mobile/language-first-fr | 663.3 [663.1–707.3] | 668.4 [665.9–682.8] |
| mobile/language-cached-es | 223.1 [178.6–227.2] | 186.4 [153.9–186.7] |
| mobile/ledger-1000-first-open | 547.3 [512.7–573.5] | 672.5 [602.4–688.7] |
| mobile/ledger-1000-filter | 578.0 [541.2–595.5] | 674.5 [673.5–733.1] |
| mobile/ledger-5000-first-open | 945.0 [879.8–1,102.9] | 1,079.1 [1,002.0–1,358.7] |
| mobile/ledger-5000-filter | 512.7 [502.1–536.0] | 512.3 [460.8–561.8] |
| tablet/landing-es-cold | 669.0 [647.1–718.0] | 651.0 [646.9–700.2] |
| tablet/landing-en-cold | 816.2 [738.9–850.8] | 814.2 [801.7–816.3] |
| tablet/application-empty-cold | 997.8 [978.6–1,050.9] | 1,386.0 [1,375.2–1,417.7] |
| tablet/application-cold | 1,346.2 [1,012.6–1,395.5] | 1,373.1 [1,060.0–1,449.8] |
| tablet/application-warm | 527.3 [516.9–531.8] | 530.4 [521.1–544.4] |
| tablet/chart-first-open | 865.6 [432.9–867.8] | 882.7 [868.0–895.1] |
| tablet/planning-first-open | 485.5 [438.5–595.5] | 482.2 [465.6–555.0] |
| tablet/catalog-first-open | 878.6 [622.5–890.1] | 569.8 [496.1–571.6] |
| tablet/ledger-100-first-open | 401.8 [372.5–422.3] | 369.5 [358.9–413.0] |
| tablet/ledger-100-filter | 148.1 [134.4–152.5] | 131.2 [125.1–148.3] |
| tablet/language-first-fr | 340.7 [329.6–351.9] | 336.4 [333.4–338.2] |
| tablet/language-cached-es | 116.4 [98.6–123.4] | 103.7 [100.1–122.6] |
| tablet/ledger-1000-first-open | 306.6 [305.7–352.8] | 313.0 [280.5–313.2] |
| tablet/ledger-1000-filter | 280.1 [250.1–349.0] | 270.4 [226.1–321.6] |
| tablet/ledger-5000-first-open | 422.5 [382.0–442.2] | 403.2 [320.1–427.7] |
| tablet/ledger-5000-filter | 294.9 [218.8–300.8] | 225.2 [200.6–249.0] |
| desktop/landing-es-cold | 421.1 [405.0–431.3] | 427.7 [383.9–475.2] |
| desktop/landing-en-cold | 508.7 [462.5–552.0] | 513.7 [415.6–544.6] |
| desktop/application-empty-cold | 690.1 [633.4–730.3] | 699.2 [699.1–706.9] |
| desktop/application-cold | 692.9 [667.9–750.3] | 708.0 [700.5–712.2] |
| desktop/application-warm | 447.9 [402.7–481.3] | 423.4 [419.0–433.0] |
| desktop/chart-first-open | 830.2 [830.2–849.8] | 836.4 [827.9–844.8] |
| desktop/planning-first-open | 848.9 [457.5–850.3] | 452.6 [401.2–867.1] |
| desktop/catalog-first-open | 833.2 [432.8–861.1] | 852.1 [849.9–877.1] |
| desktop/ledger-100-first-open | 165.1 [150.8–183.3] | 182.1 [166.3–231.6] |
| desktop/ledger-100-filter | 83.4 [66.7–86.6] | 74.3 [66.3–85.6] |
| desktop/language-first-fr | 166.0 [165.3–232.9] | 185.0 [184.4–213.2] |
| desktop/language-cached-es | 68.0 [52.4–71.8] | 66.1 [49.7–66.1] |
| desktop/ledger-1000-first-open | 163.9 [134.5–183.0] | 157.8 [135.0–177.1] |
| desktop/ledger-1000-filter | 166.0 [136.3–229.4] | 128.9 [124.9–129.4] |
| desktop/ledger-5000-first-open | 228.3 [220.6–278.8] | 200.1 [199.4–217.3] |
| desktop/ledger-5000-filter | 136.2 [133.9–137.6] | 138.1 [131.5–141.1] |

## Recorridos con confirmación y recuperación

| Perfil / recorrido | Antes, ms mediana [mín–máx] | Después, ms mediana [mín–máx] |
| --- | --- | --- |
| mobile/month-previous | 201.0 [193.6–243.1] | 182.5 [179.9–209.6] |
| mobile/movement-form-open | 248.8 [217.9–345.6] | 255.7 [242.4–293.0] |
| mobile/movement-amount-input | 92.3 [65.8–110.0] | 89.6 [75.0–124.2] |
| mobile/shared-expense-open | 573.2 [517.5–769.5] | 675.6 [604.6–737.4] |
| mobile/assistant-first-open | 1,262.3 [1,198.6–1,276.1] | 1,212.5 [1,190.6–1,360.9] |
| mobile/assistant-proposal | 215.9 [180.4–221.7] | 174.9 [144.4–211.2] |
| mobile/import-validate-preview | 259.9 [170.9–292.1] | 249.0 [212.8–269.9] |
| mobile/restore-verified-confirmation | 195.5 [187.0–233.5] | 205.2 [203.8–221.8] |
| tablet/month-previous | 117.6 [109.9–130.9] | 111.2 [108.6–137.3] |
| tablet/movement-form-open | 127.3 [126.2–138.0] | 125.4 [124.7–146.1] |
| tablet/movement-amount-input | 52.5 [37.3–119.8] | 40.0 [37.3–48.8] |
| tablet/shared-expense-open | 304.3 [284.9–337.6] | 341.9 [317.0–342.2] |
| tablet/assistant-first-open | 917.1 [447.3–932.2] | 926.2 [463.0–937.3] |
| tablet/assistant-proposal | 101.0 [100.2–115.0] | 102.2 [98.7–118.5] |
| tablet/import-validate-preview | 138.3 [94.4–140.5] | 134.4 [111.3–135.0] |
| tablet/restore-verified-confirmation | 108.0 [102.4–128.8] | 133.0 [130.8–162.5] |
| desktop/month-previous | 74.4 [72.5–103.0] | 96.8 [76.4–97.5] |
| desktop/movement-form-open | 99.7 [91.9–105.4] | 101.7 [94.5–107.1] |
| desktop/movement-amount-input | 40.4 [39.8–42.3] | 41.1 [41.0–41.7] |
| desktop/shared-expense-open | 187.0 [165.2–188.8] | 166.5 [165.6–215.3] |
| desktop/assistant-first-open | 877.2 [406.8–888.7] | 879.8 [879.8–901.9] |
| desktop/assistant-proposal | 73.1 [55.9–121.6] | 55.9 [55.5–56.6] |
| desktop/import-validate-preview | 61.8 [59.9–69.3] | 63.7 [57.8–68.2] |
| desktop/restore-verified-confirmation | 85.6 [85.0–86.2] | 101.4 [87.9–103.0] |

## Datos y límites

144filas antes y144después en el arnés de carga;72antes y72después en recorridos. Cero errores/peticiones externas. Hashes financieros equivalentes;en recorridos solo la restauración confirmada puede escribir y conserva copia recuperable verificada. Las métricas de heap son aproximaciones de CDP,sin GC forzado,no RSS de la aplicación.

Se conservan los perfiles CPU y JSON comprimidos de ambas versiones en este directorio. Los comparadores verifican versiones,perfiles,número de muestras y equivalencia de fixtures/proyecciones antes de generar estas tablas. La primera sonda exploratoria se excluye porque compartió CPU;no entra en estas cifras.

No se ha medido arranque ni memoria de Android/WKWebView: no hay ejecución nativa disponible. El APK unsigned ocupa5.543.039B y contiene2.450.652B de46recursos locales. Estos bytes de paquete no son memoria de ejecución.
