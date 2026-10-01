package com.tagmanagement.security;

import com.tagmanagement.common.BusinessException;
import com.tagmanagement.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final TokenService tokenService;
    private final AuthService authService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod()) || isPublicPath(request.getRequestURI())) {
            return true;
        }
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        String token = resolveToken(request);
        Map<String, Object> payload = tokenService.verify(token);
        Long userId = ((Number) payload.get("userId")).longValue();
        CurrentUser currentUser = authService.buildCurrentUser(userId);
        CurrentUserContext.set(currentUser);

        RequirePermission permission = resolvePermission(handlerMethod);
        if (permission != null && !currentUser.hasPermission(permission.value())) {
            throw BusinessException.forbidden("当前账号无权执行该操作");
        }
        return true;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception ex
    ) {
        CurrentUserContext.clear();
    }

    private boolean isPublicPath(String uri) {
        return "/api/auth/login".equals(uri) || "/api/health".equals(uri);
    }

    private String resolveToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw BusinessException.unauthorized("请先登录");
        }
        return authorization.substring("Bearer ".length()).trim();
    }

    private RequirePermission resolvePermission(HandlerMethod handlerMethod) {
        RequirePermission methodPermission = handlerMethod.getMethodAnnotation(RequirePermission.class);
        if (methodPermission != null) {
            return methodPermission;
        }
        return handlerMethod.getBeanType().getAnnotation(RequirePermission.class);
    }
}

