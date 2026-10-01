package com.tagmanagement;

import com.tagmanagement.config.AppProperties;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@MapperScan("com.tagmanagement.mapper")
@EnableConfigurationProperties(AppProperties.class)
@SpringBootApplication
public class TagManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(TagManagementApplication.class, args);
    }
}
