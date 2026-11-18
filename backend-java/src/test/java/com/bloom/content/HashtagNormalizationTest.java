package com.bloom.content;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class HashtagNormalizationTest {
    @Test
    void stripsHashesTrimsAndDeduplicatesCaseInsensitively() {
        assertThat(ContentService.normalizeHashtags(List.of("#Herbs", " herbs ", "##smallSpace", "  ", "#")))
                .containsExactly("Herbs", "smallSpace");
        assertThat(ContentService.normalizeHashtags(null)).isEmpty();
    }
}
