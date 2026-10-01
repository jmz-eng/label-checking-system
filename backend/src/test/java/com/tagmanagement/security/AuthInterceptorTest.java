package com.tagmanagement.security;

import com.tagmanagement.common.BusinessException;
import com.tagmanagement.service.AuthService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthInterceptorTest {

    private final TokenService tokenService = mock(TokenService.class);
    private final AuthService authService = mock(AuthService.class);
    private final AuthInterceptor interceptor = new AuthInterceptor(tokenService, authService);

    @AfterEach
    void clearContext() {
        CurrentUserContext.clear();
    }

    @Test
    void shouldAllowPublicHealthEndpoint() {
        MockHttpServletRequest request = request("/api/health");

        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void shouldRejectRequestWithoutToken() throws Exception {
        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> interceptor.preHandle(request("/api/secured"), new MockHttpServletResponse(), securedHandler())
        );

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatus());
    }

    @Test
    void shouldRejectRequestWithoutRequiredPermission() throws Exception {
        MockHttpServletRequest request = request("/api/secured");
        request.addHeader("Authorization", "Bearer valid-token");
        when(tokenService.verify("valid-token")).thenReturn(Map.of("userId", 1L));
        when(authService.buildCurrentUser(1L)).thenReturn(user(Set.of("sample:view")));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> interceptor.preHandle(request, new MockHttpServletResponse(), securedHandler())
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatus());
    }

    @Test
    void shouldAllowAuthorizedRequestAndClearContext() throws Exception {
        MockHttpServletRequest request = request("/api/secured");
        request.addHeader("Authorization", "Bearer valid-token");
        when(tokenService.verify("valid-token")).thenReturn(Map.of("userId", 1L));
        when(authService.buildCurrentUser(1L)).thenReturn(user(Set.of("audit:view")));
        HandlerMethod handler = securedHandler();

        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), handler));
        assertEquals(1L, CurrentUserContext.get().getId());

        interceptor.afterCompletion(request, new MockHttpServletResponse(), handler, null);
        assertThrows(BusinessException.class, CurrentUserContext::get);
    }

    private MockHttpServletRequest request(String uri) {
        return new MockHttpServletRequest("GET", uri);
    }

    private HandlerMethod securedHandler() throws NoSuchMethodException {
        Method method = SecuredEndpoint.class.getDeclaredMethod("readAudit");
        return new HandlerMethod(new SecuredEndpoint(), method);
    }

    private CurrentUser user(Set<String> permissions) {
        return new CurrentUser(1L, "tester", "测试用户", Set.of("TEST"), permissions);
    }

    private static class SecuredEndpoint {

        @RequirePermission("audit:view")
        public void readAudit() {
        }
    }
}
