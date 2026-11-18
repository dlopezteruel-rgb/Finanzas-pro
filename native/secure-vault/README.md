# FinanceVault — development-only native persistence

Local Capacitor 8 plugin. SQLCipher Community 4.20.0 is linked natively on Android/iOS;
no database engine or key is shipped in the web bundle. The SQL protocol is shared
with the real SQLite integration tests. See docs/phase-5h-secure-native-storage.md.

**Not approved for real financial data.** Release builds reject every storage call.
Debug builds require explicit fictitious-sandbox acknowledgement. The bridge exposes
no arbitrary SQL, secret retrieval, reset or automatic deletion operation.

SQLCipher: copyright ZETETIC LLC, BSD terms in SQLCipher-LICENSE.md. SQLCipher's
upstream distributions include their own notices for SQLite/crypto dependencies;
retain those notices in any future distribution. Android and Apple platform crypto
APIs protect the database key. This is not a FIPS-certified product.
