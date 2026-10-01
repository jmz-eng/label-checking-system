package com.tagmanagement.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@Data
@Validated
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    @NotBlank(message = "JWT 密钥不能为空")
    @Size(min = 32, message = "JWT 密钥长度不能少于 32 位")
    private String jwtSecret;

    @Min(value = 1, message = "登录令牌有效期至少为 1 小时")
    private long tokenExpireHours = 12;

    @NotEmpty(message = "至少需要配置一个允许跨域访问的来源")
    private List<String> corsAllowedOriginPatterns = List.of("http://localhost:*", "http://127.0.0.1:*");

    private boolean bootstrapEnabled;

    private String bootstrapAdminPassword;

    private String bootstrapTechPassword;

    private String bootstrapAnalystPassword;

    private String bootstrapAuditorPassword;
}
