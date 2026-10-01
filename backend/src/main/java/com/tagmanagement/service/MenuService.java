package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessConstants;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.dto.MenuResponse;
import com.tagmanagement.dto.MenuSaveRequest;
import com.tagmanagement.entity.SysMenu;
import com.tagmanagement.mapper.SysMenuMapper;
import com.tagmanagement.security.CurrentUser;
import com.tagmanagement.security.CurrentUserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final SysMenuMapper menuMapper;
    private final AuditLogService auditLogService;

    public List<MenuResponse> listAllTree() {
        List<SysMenu> menus = menuMapper.selectList(new LambdaQueryWrapper<SysMenu>()
                .orderByAsc(SysMenu::getParentId)
                .orderByAsc(SysMenu::getSortOrder));
        return buildTree(menus);
    }

    public List<MenuResponse> currentUserRoutes() {
        CurrentUser user = CurrentUserContext.get();
        List<SysMenu> menus = menuMapper.selectList(new LambdaQueryWrapper<SysMenu>()
                        .eq(SysMenu::getVisible, true)
                        .eq(SysMenu::getStatus, BusinessConstants.STATUS_ENABLED)
                        .orderByAsc(SysMenu::getParentId)
                        .orderByAsc(SysMenu::getSortOrder))
                .stream()
                .filter(menu -> canSee(menu, user) && isRoutableMenu(menu))
                .toList();
        return buildTreeWithVisibleParents(menus);
    }

    @Transactional
    public MenuResponse create(MenuSaveRequest request) {
        if (menuMapper.selectOne(new LambdaQueryWrapper<SysMenu>()
                .eq(SysMenu::getMenuKey, request.getMenuKey().trim())) != null) {
            throw BusinessException.conflict("菜单标识已存在");
        }
        SysMenu menu = new SysMenu();
        fillMenu(menu, request);
        menuMapper.insert(menu);
        auditLogService.record("菜单", "新增菜单", menu.getMenuKey(), "新增菜单：" + menu.getMenuName());
        return toResponse(menu);
    }

    @Transactional
    public MenuResponse update(Long id, MenuSaveRequest request) {
        SysMenu menu = menuMapper.selectById(id);
        if (menu == null) {
            throw BusinessException.notFound("菜单不存在");
        }
        SysMenu existed = menuMapper.selectOne(new LambdaQueryWrapper<SysMenu>()
                .eq(SysMenu::getMenuKey, request.getMenuKey().trim())
                .ne(SysMenu::getId, id));
        if (existed != null) {
            throw BusinessException.conflict("菜单标识已存在");
        }
        fillMenu(menu, request);
        menuMapper.updateById(menu);
        auditLogService.record("菜单", "更新菜单", menu.getMenuKey(), "更新菜单：" + menu.getMenuName());
        return toResponse(menu);
    }

    private boolean canSee(SysMenu menu, CurrentUser user) {
        return !StringUtils.hasText(menu.getPermissionCode()) || user.hasPermission(menu.getPermissionCode());
    }

    private boolean isRoutableMenu(SysMenu menu) {
        return !"LAYOUT".equals(menu.getComponent()) || StringUtils.hasText(menu.getRoutePath());
    }

    private List<MenuResponse> buildTree(List<SysMenu> menus) {
        Map<Long, MenuResponse> map = new LinkedHashMap<>();
        menus.stream()
                .sorted(Comparator.comparing(SysMenu::getSortOrder))
                .forEach(menu -> map.put(menu.getId(), toResponse(menu)));
        return map.values().stream()
                .filter(menu -> {
                    if (menu.getParentId() == 0) {
                        return true;
                    }
                    MenuResponse parent = map.get(menu.getParentId());
                    if (parent != null) {
                        parent.getChildren().add(menu);
                    }
                    return false;
                })
                .toList();
    }

    private List<MenuResponse> buildTreeWithVisibleParents(List<SysMenu> menus) {
        Map<Long, SysMenu> allMenus = menuMapper.selectList(new LambdaQueryWrapper<SysMenu>()
                        .eq(SysMenu::getVisible, true)
                        .eq(SysMenu::getStatus, BusinessConstants.STATUS_ENABLED))
                .stream()
                .collect(LinkedHashMap::new, (map, item) -> map.put(item.getId(), item), Map::putAll);
        Map<Long, SysMenu> included = new LinkedHashMap<>();
        for (SysMenu menu : menus) {
            SysMenu cursor = menu;
            while (cursor != null && !included.containsKey(cursor.getId())) {
                included.put(cursor.getId(), cursor);
                cursor = Objects.equals(cursor.getParentId(), 0L) ? null : allMenus.get(cursor.getParentId());
            }
        }
        return buildTree(included.values().stream()
                .sorted(Comparator.comparing(SysMenu::getParentId).thenComparing(SysMenu::getSortOrder))
                .toList());
    }

    private void fillMenu(SysMenu menu, MenuSaveRequest request) {
        menu.setParentId(request.getParentId());
        menu.setMenuKey(request.getMenuKey().trim());
        menu.setMenuName(request.getMenuName().trim());
        menu.setRoutePath(trimToNull(request.getRoutePath()));
        menu.setComponent(trimToNull(request.getComponent()));
        menu.setPermissionCode(trimToNull(request.getPermissionCode()));
        menu.setIcon(trimToNull(request.getIcon()));
        menu.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        menu.setVisible(request.getVisible() == null || request.getVisible());
        menu.setStatus(StringUtils.hasText(request.getStatus()) ? request.getStatus() : BusinessConstants.STATUS_ENABLED);
    }

    private MenuResponse toResponse(SysMenu menu) {
        return new MenuResponse(
                menu.getId(),
                menu.getParentId(),
                menu.getMenuKey(),
                menu.getMenuName(),
                menu.getRoutePath(),
                menu.getComponent(),
                menu.getPermissionCode(),
                menu.getIcon(),
                menu.getSortOrder(),
                menu.getVisible(),
                menu.getStatus(),
                new java.util.ArrayList<>()
        );
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
