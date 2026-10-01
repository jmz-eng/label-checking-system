package com.tagmanagement.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.config.AppProperties;
import com.tagmanagement.entity.SysUser;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class TokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final ObjectMapper objectMapper;
    private final String secret;
    private final long tokenExpireHours;

    public TokenService(ObjectMapper objectMapper, AppProperties appProperties) {
        this.objectMapper = objectMapper;
        this.secret = appProperties.getJwtSecret();
        this.tokenExpireHours = appProperties.getTokenExpireHours();
    }

    public String createToken(SysUser user) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("userId", user.getId());
            payload.put("username", user.getUsername());
            payload.put("exp", Instant.now().plusSeconds(tokenExpireHours * 3600).getEpochSecond());
            String payloadJson = objectMapper.writeValueAsString(payload);
            String encodedPayload = base64Url(payloadJson.getBytes(StandardCharsets.UTF_8));
            return encodedPayload + "." + sign(encodedPayload);
        } catch (Exception ex) {
            throw BusinessException.badRequest("登录令牌生成失败");
        }
    }

    public Map<String, Object> verify(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 2) {
                throw BusinessException.unauthorized("登录令牌格式不正确");
            }
            String expectedSign = sign(parts[0]);
            if (!constantTimeEquals(expectedSign, parts[1])) {
                throw BusinessException.unauthorized("登录令牌签名无效");
            }
            byte[] json = Base64.getUrlDecoder().decode(parts[0]);
            Map<String, Object> payload = objectMapper.readValue(json, new TypeReference<>() {
            });
            long exp = ((Number) payload.get("exp")).longValue();
            if (Instant.now().getEpochSecond() > exp) {
                throw BusinessException.unauthorized("登录已过期，请重新登录");
            }
            return payload;
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw BusinessException.unauthorized("登录令牌无效");
        }
    }

    private String sign(String content) throws Exception {
        Mac mac = Mac.getInstance(HMAC_ALGORITHM);
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
        return base64Url(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
    }

    private String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < a.length(); i++) {
            result |= a.charAt(i) ^ b.charAt(i);
        }
        return result == 0;
    }
}
