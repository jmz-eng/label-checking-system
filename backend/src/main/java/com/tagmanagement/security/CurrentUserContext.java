package com.tagmanagement.security;

import com.tagmanagement.common.BusinessException;

public final class CurrentUserContext {

    private static final ThreadLocal<CurrentUser> CURRENT = new ThreadLocal<>();

    private CurrentUserContext() {
    }

    public static void set(CurrentUser user) {
        CURRENT.set(user);
    }

    public static CurrentUser get() {
        CurrentUser user = CURRENT.get();
        if (user == null) {
            throw BusinessException.unauthorized("请先登录");
        }
        return user;
    }

    public static Long getUserIdOrNull() {
        CurrentUser user = CURRENT.get();
        return user == null ? null : user.getId();
    }

    public static void clear() {
        CURRENT.remove();
    }
}

