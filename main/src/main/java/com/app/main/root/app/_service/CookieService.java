package com.app.main.root.app._service;
import org.springframework.stereotype.Service;
import com.app.main.root.EnvConfig;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import java.util.Arrays;
import java.util.Optional;

@Service
public class CookieService {
    private String webUrl = EnvConfig.get("WEB_URL");
    public static final String SESSION_ID_KEY = "SESSION_ID";
    public static final String USER_INFO_KEY = "USER_INFO";
    public static final String REMEMBER_USER = "REMEMBER_USER";
    public static final String SESSION_STATUS_KEY = "SESSION_STATUS";

    @Value("${cookie.domain:localhost}")
    private String cookieDomain;

    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @PostConstruct
    public void init() {
        System.out.println("=== CookieService Initialized ===");
        System.out.println("SESSION_ID_KEY: " + SESSION_ID_KEY);
        System.out.println("USER_INFO_KEY: " + USER_INFO_KEY);
        System.out.println("SESSION_STATUS_KEY: " + SESSION_STATUS_KEY);
        System.out.println("cookieDomain: " + cookieDomain);
        System.out.println("cookieSecure: " + cookieSecure);
        System.out.println("webUrl: " + webUrl);
        System.out.println("===============================");
    }
    
    /**
     * Get Cookie Value
     */
    public Optional<String> getCookieValue(HttpServletRequest request, String name) {
        if(request.getCookies() == null) return Optional.empty();

        return Arrays.stream(request.getCookies())
            .filter(cookie -> name.equals(cookie.getName()))
            .map(Cookie::getValue)
            .findFirst();
    }

    /**
     * Create Cookie
     */
    public Cookie createCookie(String name, String value, int maxAge) {        
        if (name == null || name.trim().isEmpty()) {
            System.err.println("ERR Cookie name is null or empty! name=" + name);
        }
        
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);

        if(cookieDomain != null && 
            !cookieDomain.equals("localhost") && 
            !cookieDomain.equals(webUrl)
        ) {
            cookie.setDomain(cookieDomain);
        } else {
            System.out.println("Not setting domain");
        }
        
        return cookie;
    }

    public Cookie createClientCookie(String name, String value, int maxAge) {        
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(false);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        
        if(cookieDomain != null && !cookieDomain.equals("localhost")) {
            cookie.setDomain(cookieDomain);
        }
        
        return cookie;
    }

    /**
     * Delete Cookie
     */
    public void deleteCookie(HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, null);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        if(cookieDomain != null && !cookieDomain.equals("localhost")) {
            cookie.setDomain(cookieDomain);
        }
        response.addCookie(cookie);
    }

    public void deleteClientCookie(HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, null);
        cookie.setHttpOnly(false);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        if(cookieDomain != null && !cookieDomain.equals("localhost")) {
            cookie.setDomain(cookieDomain);
        }
        response.addCookie(cookie);
    }

    /**
     * 
     * Auth Cookies
     * 
     */
    public void setAuthCookies(
        HttpServletResponse response,
        String sessionId,
        String userId,
        String username,
        String email,
        boolean remember
    ) {
        System.out.println("=== Setting Auth Cookies ===");
        System.out.println("sessionId: " + sessionId);
        System.out.println("userId: " + userId);
        System.out.println("username: " + username);
        System.out.println("remember: " + remember);
        System.out.println("SESSION_ID_KEY: " + SESSION_ID_KEY);
        System.out.println("USER_INFO_KEY: " + USER_INFO_KEY);
        System.out.println("SESSION_STATUS_KEY: " + SESSION_STATUS_KEY);
        int rememberRes = remember ? 7 * 24 * 60 * 60 : 30 * 60;
        String userRes = String.format("%s:%s:%s:%s", 
            sessionId != null ? sessionId : "",
            userId != null ? userId : "",
            username != null ? username : "",
            email != null ? email : ""
        );

        Cookie sessionCookie = createCookie(
            SESSION_ID_KEY,
            sessionId,
            rememberRes
        );
        response.addCookie(sessionCookie);

        Cookie userCookie = createClientCookie(
            USER_INFO_KEY, 
            userRes, 
            rememberRes
        );
        System.out.println("REMEMBER RES " + rememberRes);
        System.out.println("REMEBER: " + remember);
        response.addCookie(userCookie);

        Cookie rememberCookie = createClientCookie(
            REMEMBER_USER, 
            Boolean.toString(remember), 
            rememberRes
        );
        response.addCookie(rememberCookie);

        Cookie statusCookie = createClientCookie(
            SESSION_STATUS_KEY,
            "active",
            rememberRes
        );
        response.addCookie(statusCookie);
    }

    public void clearAuthCookies(HttpServletResponse response) {
        deleteCookie(response, SESSION_ID_KEY);
        deleteClientCookie(response, USER_INFO_KEY);
        deleteClientCookie(response, REMEMBER_USER);
        deleteClientCookie(response, SESSION_STATUS_KEY);
    }
}
