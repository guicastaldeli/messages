package com.app.main.root.app._auth;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.util.StringUtils;
import com.app.main.root.app._service.SessionService;
import com.app.main.root.app._service.UserService;
import java.io.IOException;
import java.util.List;

public class AuthFilter extends OncePerRequestFilter {
    private final TokenService tokenService;
    private final SessionService sessionService;
    private final UserService userService;

    public AuthFilter(
        TokenService tokenService, 
        UserService userService,
        SessionService sessionService
    ) {
        this.tokenService = tokenService;
        this.userService = userService;
        this.sessionService = sessionService;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        if(isPublicEndpoint(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = extractToken(request);
        if(StringUtils.hasText(token) && tokenService.validateToken(token)) {
            String userId = tokenService.extractUserId(token);
            String sessionId = tokenService.extractSessionId(token);
            if(sessionService.validateSession(sessionId)) {
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                        userId,
                        null,
                        List.of()
                    );
                    auth.setDetails(
                        new WebAuthenticationDetailsSource()
                            .buildDetails(request)
                    );

                SecurityContextHolder.getContext().setAuthentication(auth);
                sessionService.getSession(sessionId).updateActivity();
            }
        }
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if(StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        Cookie[] cookies = request.getCookies();
        if(cookies != null) {
            for(Cookie cookie : cookies) {
                if("auth_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        return null;
    }

    private boolean isPublicEndpoint(String uri) {
        return uri.startsWith("/api/auth/") ||
            uri.startsWith("/api/users/check") ||
            uri.startsWith("/main") ||
            uri.startsWith("/ws") ||
            uri.equals("/error") ||
            uri.equals("/favicon.ico");
    }
}
