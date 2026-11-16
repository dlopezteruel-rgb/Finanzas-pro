package invalid.finanzas.prototype.vault;

final class VaultFailure extends RuntimeException {
    final String code;
    VaultFailure(String code) { super(code); this.code = code; }
}
