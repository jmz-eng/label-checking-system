package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.LoginRequest;
import com.tagmanagement.dto.LoginResponse;
import com.tagmanagement.dto.UserProfileResponse;
import com.tagmanagement.security.CurrentUserContext;
import com.tagmanagement.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ApiResponse<UserProfileResponse> me() {
        return ApiResponse.ok(authService.getProfile(CurrentUserContext.get().getId()));
    }
}

