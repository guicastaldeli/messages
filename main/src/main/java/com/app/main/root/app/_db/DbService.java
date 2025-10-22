package com.app.main.root.app._db;
import com.app.main.root.EnvConfig;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.stereotype.Service;
import javax.sql.DataSource;
import org.springframework.web.client.RestTemplate;

@Service
public class DbService {
    private final RestTemplate restTemplate;
    public final ColorConverter colorConverter;
    private final String apiUrl = EnvConfig.get("API_URL");
    private DbConfig dbConfig;
    private FileManager fileManager;

    public DbService(
        DataSource dataSource, 
        ColorConverter colorConverter
    ) {
        this.restTemplate = new RestTemplate();
        this.colorConverter = colorConverter;
    }

    public void alert() {
        System.out.println(
            colorConverter.style("ALERT", "red", "italic") + ", " +
            colorConverter.style("Database initialized :)", "orange", "bold") +
            colorConverter.style("\nServices connected to API at: ", "green", "italic") +
            colorConverter.style(apiUrl, "brightGreen", "italic")
        );
        dbConfig.verify();
        fileManager.verify();
    }
}