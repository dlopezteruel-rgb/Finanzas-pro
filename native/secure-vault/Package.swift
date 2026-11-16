// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "FinanzasNativeVault",
    platforms: [.iOS(.v15)],
    products: [.library(name: "FinanzasNativeVault", targets: ["FinanceVaultPlugin"])],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.2"),
        .package(url: "https://github.com/sqlcipher/SQLCipher.swift.git", exact: "4.20.0")
    ],
    targets: [.target(name: "FinanceVaultPlugin", dependencies: [
        .product(name: "Capacitor", package: "capacitor-swift-pm"),
        .product(name: "SQLCipher", package: "SQLCipher.swift")
    ], path: ".", sources: ["ios/Sources/FinanceVaultPlugin"], resources: [.copy("protocol")])],
    swiftLanguageModes: [.v5]
)
