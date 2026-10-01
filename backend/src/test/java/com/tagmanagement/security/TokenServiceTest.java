package com.tagmanagement.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.config.AppProperties;
import com.tagmanagement.entity.SysUser;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TokenServiceTest {

    private static final String TEST_SECRET = "test-secret-with-at-least-thirty-two-characters";

    @Test
    void shouldCreateAndVerifyToken() {
        TokenService tokenService = createTokenService(12);
        SysUser user = new SysUser();
        user.setId(7L);
        user.setUsername("tester");

        Map<String, Object> payload = tokenService.verify(tokenService.createToken(user));

        assertEquals(7L, ((Number) payload.get("userId")).longValue());
        assertEquals("tester", payload.get("username"));
    }

    @Test
    void shouldRejectTamperedToken() {
        TokenService tokenService = createTokenService(12);
        SysUser user = new SysUser();
        user.setId(7L);
        user.setUsername("tester");
        String token = tokenService.createToken(user);

        assertThrows(BusinessException.class, () -> tokenService.verify(token + "x"));
    }

    @Test
    void shouldRejectExpiredToken() {
        TokenService tokenService = createTokenService(-1);
        SysUser user = new SysUser();
        user.setId(7L);
        user.setUsername("tester");

        assertThrows(BusinessException.class, () -> tokenService.verify(tokenService.createToken(user)));
    }

    private TokenService createTokenService(long expireHours) {
        AppProperties properties = new AppProperties();
        properties.setJwtSecret(TEST_SECRET);
        properties.setTokenExpireHours(expireHours);
        return new TokenService(new ObjectMapper(), properties);
    }
}
