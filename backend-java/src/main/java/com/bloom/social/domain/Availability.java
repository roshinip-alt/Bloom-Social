package com.bloom.social.domain;

/** Why a metric value is (or is not) present. A null value is never displayed as zero. */
public enum Availability { AVAILABLE, NOT_SUPPORTED, PERMISSION_MISSING, NOT_ENOUGH_DATA, DELAYED }
