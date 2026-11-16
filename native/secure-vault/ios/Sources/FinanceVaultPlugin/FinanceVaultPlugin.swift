import Foundation
import Capacitor
import UIKit
import UniformTypeIdentifiers

@objc(FinanceVaultPlugin)
public class FinanceVaultPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "FinanceVaultPlugin"
    public let jsName = "FinanceVault"
    public let pluginMethods = ["status", "openSandbox", "read", "commit", "resolveOperation", "recoveries", "close", "pickDocument", "configureFault"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private static let queue = DispatchQueue(label: "invalid.finanzas.prototype.vault")
    private let lifecycleLock = NSLock()
    private var foreground = true
    private var enabled = false
    private var vault: VaultDatabase?
    private var observers: [NSObjectProtocol] = []
    private var documentCall: CAPPluginCall?
    override public func load() {
        vault = try? VaultDatabase()
        updateLifecycle()
        for name in [UIApplication.willResignActiveNotification, UIApplication.protectedDataWillBecomeUnavailableNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                guard let self = self else { return }; self.lifecycleLock.lock(); self.foreground = false; self.lifecycleLock.unlock()
                Self.queue.async { self.vault?.close() }
            })
        }
        for name in [UIApplication.didBecomeActiveNotification, UIApplication.protectedDataDidBecomeAvailableNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in self?.updateLifecycle() })
        }
    }
    deinit { observers.forEach { NotificationCenter.default.removeObserver($0) }; let closing = vault; Self.queue.async { closing?.close() } }
    private func updateLifecycle() { lifecycleLock.lock(); foreground = UIApplication.shared.applicationState == .active && UIApplication.shared.isProtectedDataAvailable; lifecycleLock.unlock() }
    private func allowed() throws {
        #if !DEBUG
        throw VaultFailure.code("VAULT_DISABLED")
        #else
        lifecycleLock.lock(); let active = foreground, sandbox = enabled; lifecycleLock.unlock()
        guard sandbox, active else { throw VaultFailure.code(sandbox ? "VAULT_LOCKED" : "VAULT_DISABLED") }
        #endif
    }
    private func perform(_ call: CAPPluginCall, _ operation: @escaping (VaultDatabase) throws -> JSObject) {
        Self.queue.async {
            do { try self.allowed(); guard let vault = self.vault else { throw VaultFailure.code("VAULT_FAILED") }; call.resolve(try operation(vault)) }
            catch VaultFailure.code(let code) { call.reject("Native storage operation could not be confirmed.", code) }
            catch { call.reject("Native storage operation could not be confirmed.", "VAULT_UNCERTAIN") }
        }
    }
    @objc func status(_ call: CAPPluginCall) { call.resolve(["testOnly": true, "productEnabled": false, "databaseExists": vault?.exists ?? false, "platform": "ios"]) }
    @objc func openSandbox(_ call: CAPPluginCall) {
        #if !DEBUG
        call.reject("Prototype storage is disabled.", "VAULT_DISABLED")
        #else
        guard call.getBool("acknowledgedFictitious") == true else { call.reject("Prototype storage is disabled.", "VAULT_DISABLED"); return }
        lifecycleLock.lock(); enabled = true; lifecycleLock.unlock()
        perform(call) { vault in try vault.open(initialize: true); return ["testOnly": true, "cipherVersion": vault.cipherVersion, "sqliteVersion": vault.sqliteVersion] }
        #endif
    }
    @objc func read(_ call: CAPPluginCall) { perform(call) { ["head": try $0.head() as Any? ?? NSNull()] } }
    @objc func commit(_ call: CAPPluginCall) { perform(call) { vault in guard let payload = call.getString("payload") else { throw VaultFailure.code("VAULT_INVALID") }; return try vault.commit(payload) } }
    @objc func resolveOperation(_ call: CAPPluginCall) { perform(call) { vault in guard let id = call.getString("operationId"), let fingerprint = call.getString("fingerprint") else { throw VaultFailure.code("VAULT_INVALID") }; return try vault.resolve(id, fingerprint) } }
    @objc func recoveries(_ call: CAPPluginCall) { perform(call) { ["copies": try $0.recoveries()] } }
    @objc func close(_ call: CAPPluginCall) { perform(call) { $0.close(); return [:] } }
    @objc func configureFault(_ call: CAPPluginCall) { perform(call) { vault in let point = call.getString("point") ?? ""; guard ["", "beforeBegin", "afterBegin", "afterRecovery", "beforeCommit", "afterCommit"].contains(point) else { throw VaultFailure.code("VAULT_INVALID") }; vault.fault = point; return [:] } }
    @objc func pickDocument(_ call: CAPPluginCall) {
        do { try allowed() } catch { call.reject("Document selection is disabled.", "VAULT_DISABLED"); return }
        DispatchQueue.main.async {
            guard self.documentCall == nil else { call.reject("Document selection is pending.", "VAULT_INVALID"); return }
            self.documentCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: false)
            picker.delegate = self; picker.allowsMultipleSelection = false
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { documentCall?.resolve(["cancelled": true]); documentCall = nil }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = documentCall else { return }; documentCall = nil
        guard let url = urls.first else { call.resolve(["cancelled": true]); return }
        Self.queue.async {
            do { try self.allowed() } catch { call.reject("Document selection is unavailable.", "VAULT_LOCKED"); return }
            guard url.startAccessingSecurityScopedResource() else { call.reject("File access was denied.", "VAULT_INVALID"); return }
            defer { url.stopAccessingSecurityScopedResource() }
            var coordinationError: NSError?, result: Data?, readError: Error?
            NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges, error: &coordinationError) { selected in
                do { let handle = try FileHandle(forReadingFrom: selected); defer { try? handle.close() }; result = try handle.read(upToCount: 10485761) } catch { readError = error }
            }
            guard coordinationError == nil, readError == nil, let bytes = result, bytes.count <= 10485760, let text = String(data: bytes, encoding: .utf8) else { call.reject("File could not be read.", "VAULT_INVALID"); return }
            call.resolve(["cancelled": false, "name": url.lastPathComponent, "content": text])
        }
    }
}
