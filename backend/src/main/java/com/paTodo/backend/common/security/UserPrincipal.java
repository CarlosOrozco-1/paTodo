package com.paTodo.backend.common.security;

import com.paTodo.backend.user.model.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public class UserPrincipal implements UserDetails {

    private final String id;
    private final String email;
    private final String password;
    private final String role;
    private final boolean accountLocked;

    public UserPrincipal(User user) {
        this.id = user.getId();
        this.email = user.getAccount().getEmail();
        this.password = user.getAccount().getPasswordHash();
        this.role = user.getRole();
        Instant lockUntil = user.getAccount().getLockUntil();
        this.accountLocked = lockUntil != null && lockUntil.isAfter(Instant.now());
    }

    public String getId() { return id; }

    public String getRole() { return role; }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
    }

    @Override
    public String getPassword() { return password; }

    @Override
    public String getUsername() { return email; }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return !accountLocked; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return true; }
}
