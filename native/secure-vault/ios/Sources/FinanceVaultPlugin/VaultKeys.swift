import Foundation
import Security

enum VaultFailure: Error { case code(String) }

enum VaultKeys {
    private static var query: [String: Any] { [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: (Bundle.main.bundleIdentifier ?? "invalid.finanzas.prototype") + ".finance-vault.v1",
        kSecAttrAccount as String: "sqlcipher-data-key",
        kSecAttrSynchronizable as String: false
    ] }
    static func load(databaseExists: Bool) throws -> Data {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        request[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecSuccess {
            guard let bytes = result as? Data, bytes.count == 32 else { throw VaultFailure.code("VAULT_KEY_INVALIDATED") }
            return bytes
        }
        if status == errSecInteractionNotAllowed || status == errSecAuthFailed { throw VaultFailure.code("VAULT_LOCKED") }
        guard status == errSecItemNotFound else { throw VaultFailure.code("VAULT_KEY_INVALIDATED") }
        guard !databaseExists else { throw VaultFailure.code("VAULT_KEY_MISSING") }
        var bytes = Data(count: 32)
        let generated = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }
        guard generated == errSecSuccess else { throw VaultFailure.code("VAULT_FAILED") }
        var insertion = query
        insertion[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        insertion[kSecValueData as String] = bytes
        let added = SecItemAdd(insertion as CFDictionary, nil)
        if added == errSecDuplicateItem {
            bytes.resetBytes(in: 0..<bytes.count)
            return try load(databaseExists: true)
        }
        guard added == errSecSuccess else { bytes.resetBytes(in: 0..<bytes.count); throw VaultFailure.code("VAULT_LOCKED") }
        return bytes
    }
}
