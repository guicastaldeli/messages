package com.app.main.root.app._auth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.*;
import javax.crypto.*;
import java.util.*;

@Service
public class TokenService {
    @Value("${jwt.secret:}")
    private String secretKey;

    @Value("${jwt.expiration:86400000}")
    private long jwtExpiration;

    @Value("${jwt.refresh-expiration:604800000}")
    private long refreshExpiration;

    private final Map<String, String> tokenBlackList = new ConcurrentHashMap<>();

    /**
     * Get Signing Key
     */
    private SecretKey getSigningKey() {
        if(secretKey == null || secretKey.isEmpty()) {
            return Jwts.SIG.HS256.key().build();
        }

        byte[] keyByets = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyByets);
    }

    /**
     * Generate Access Token
     */
    public String generateAccessToken(
        String sessionId,
        String userId, 
        String username, 
        String email
    ) {
        long time = System.currentTimeMillis();

        Map<String, Object> claims = new HashMap<>();
        claims.put("sessionId", sessionId);
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("email", email);
        claims.put("type", "access");

        return Jwts.builder()
            .claims(claims)
            .subject(userId)
            .issuedAt(new Date(time))
            .expiration(new Date(time + jwtExpiration))
            .signWith(getSigningKey(), Jwts.SIG.HS256)
            .compact();
    }

    /**
     * Generate Refresh Token
     */
    public String generateRefreshToken(String userId) {
        long time = System.currentTimeMillis();

        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("type", "refresh");

        return Jwts.builder()
            .claims(claims)
            .subject(userId)
            .issuedAt(new Date(time))
            .expiration(new Date(time + refreshExpiration))
            .signWith(getSigningKey(), Jwts.SIG.HS256)
            .compact();
    }

    /**
     * Validate Token
     */
    public boolean validateToken(String key) {
        try {
            Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(key)
                .getPayload();

            if(tokenBlackList.containsKey(key)) {
                return false;
            }
            return true;
        } catch(JwtException | IllegalArgumentException err) {
            System.out.println(err);
            return false;
        }
    }

    private<T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String key) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(key)
            .getPayload();
    }

    public String extractUserId(String token) {
        return extractClaim(
            token, 
            claims -> claims.get(
                "userId", 
                String.class
            )
        );
    }

    public String extractSessionId(String token) {
        return extractClaim(
            token, 
            claims -> claims.get(
                "sessionId", 
                String.class
            )
        );
    }

    public String extractUsername(String token) {
        return extractClaim(
            token, 
            claims -> claims.get(
                "username", 
                String.class
            )
        );
    }

    public String extractEmail(String token) {
        return extractClaim(
            token, 
            claims -> claims.get(
                "email", 
                String.class
            )
        );
    }

    public String extractType(String token) {
        return extractClaim(
            token, 
            claims -> claims.get(
                "type", 
                String.class
            )
        );
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public void blacklistToken(String token) {
        tokenBlackList.put(token, extractUserId(token));
    }

    public void cleanExpiredBlacklist() {
        tokenBlackList.entrySet()
            .removeIf(entry -> isTokenExpired(entry.getKey()));
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public String getSecretKey() {
        return secretKey;
    }
}
