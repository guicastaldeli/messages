package com.app.main.root.app.__controllers;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._types.User;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final ServiceManager serviceManager;

    public UserController(@Lazy ServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }

    /*
    * All 
    */
    @GetMapping("/all")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        try {
            List<User> users = serviceManager.getUserService().getAllUsers();
            List<Map<String, Object>> userList = users.stream()
                .map(user -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", user.getId());
                    map.put("username", user.getUsername());
                    map.put("email", user.getEmail());
                    map.put("isOnline", serviceManager.getUserService().getSessionByUserId(user.getId()) != null);
                    return map;
                })
                .collect(Collectors.toList());
            return ResponseEntity.ok(userList);
        } catch(Exception err) {
            System.err.println(err.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    /*
    * Online
    */
    @GetMapping("/online")
    public ResponseEntity<List<Map<String, Object>>> getOnlineUsers() {
        try {
            List<User> allUsers = serviceManager.getUserService().getAllUsers();
            List<Map<String, Object>> onlineUsers = allUsers.stream()
                .filter(user -> serviceManager.getUserService().getSessionByUserId(user.getId()) != null)
                .map(user -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", user.getId());
                    map.put("username", user.getUsername());
                    map.put("email", user.getEmail());
                    map.put("isOnline", serviceManager.getUserService().getSessionByUserId(user.getId()) != null);
                    return map;
                })
                .collect(Collectors.toList());
            return ResponseEntity.ok(onlineUsers);
        } catch(Exception err) {
            System.err.println(err.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    /*
    * Email
    */
    @GetMapping("/email/{email}")
    public ResponseEntity<Map<String, Object>> getUserByEmail(@PathVariable String email) {
        try {
            User user = serviceManager.getUserService().getUserByEmail(email);
            if(user != null) {
                return ResponseEntity.ok(Map.of(
                    "exists", true,
                    "user", Map.of(
                        "id", user.getId(),
                        "username", user.getUsername(),
                        "email", user.getEmail(),
                        "isOnline", serviceManager.getUserService().getSessionByUserId(user.getId()) != null
                    )
                ));
            } else {
                return ResponseEntity.ok(Map.of("exists", false));
            }
        } catch(Exception err) {
            System.err.println(err.getMessage());
            return ResponseEntity.ok(Map.of("exists", false));
        }
    }

    /*
    * Username
    */
    @GetMapping("/username/{username}")
    public ResponseEntity<Map<String, Object>> getUserIdByUsername(@PathVariable String username) {
        try {
            User user = serviceManager.getUserService().getUserIdByUsername(username);
            if(user != null) {
                return ResponseEntity.ok(Map.of(
                    "exists", true,
                    "user", Map.of(
                        "id", user.getId(),
                        "username", user.getUsername(),
                        "email", user.getEmail(),
                        "isOnline", serviceManager.getUserService().getSessionByUserId(user.getId()) != null
                    )
                ));
            } else {
                return ResponseEntity.ok(Map.of("exists", false));
            }
        } catch(Exception err) {
            System.err.println(err.getMessage());
            return ResponseEntity.ok(Map.of("exists", false));
        }
    }
}
