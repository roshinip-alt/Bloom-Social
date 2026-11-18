package com.bloom.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bloom.common.crypto.Hashing;
import com.bloom.common.crypto.TokenCipher;
import com.bloom.exception.BloomException;
import org.junit.jupiter.api.Test;

class TokenCipherTest {
    private static final String KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    @Test
    void roundTripsAndNeverEmitsPlaintext() {
        TokenCipher cipher = new TokenCipher(KEY, 1);
        String ct = cipher.encrypt("secret-access-token");
        assertThat(ct).startsWith("v1:").doesNotContain("secret");
        assertThat(cipher.encrypt("secret-access-token")).isNotEqualTo(ct); // random IV per encryption
        assertThat(cipher.decrypt(ct)).isEqualTo("secret-access-token");
    }

    @Test
    void rejectsTamperedCiphertextAndWrongKeyVersion() {
        TokenCipher cipher = new TokenCipher(KEY, 1);
        String ct = cipher.encrypt("token");
        String tampered = ct.substring(0, ct.length() - 2) + (ct.endsWith("A") ? "B" : "A") + "=";
        assertThatThrownBy(() -> cipher.decrypt(tampered)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new TokenCipher(KEY, 2).decrypt(ct)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void refusesToOperateWithoutAKey() {
        assertThatThrownBy(() -> new TokenCipher("", 1).encrypt("x")).isInstanceOf(BloomException.class);
    }

    @Test
    void pkceChallengeMatchesRfc7636Example() {
        // RFC 7636 appendix B
        assertThat(Hashing.pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
                .isEqualTo("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }
}
