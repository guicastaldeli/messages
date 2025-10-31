package com.app.main.root.app._db;
import com.app.main.root.EnvConfig;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class DbService {
    private final String apiUrl = EnvConfig.get("API_URL");
    private final RestTemplate restTemplate;
    public final ColorConverter colorConverter;
    private final DbConfig dbConfig;
    private final DbManager dbManager;
    private final DataSourceService dataSourceService;

    public DbService(
        ColorConverter colorConverter,
        DbConfig dbConfig,
        DbManager dbManager,
        DataSourceService dataSourceService
    ) {
        this.restTemplate = new RestTemplate();
        this.colorConverter = colorConverter;
        this.dbConfig = dbConfig;
        this.dbManager = dbManager;
        this.dataSourceService = dataSourceService;
    }

    public void alert() {
        System.out.println(
            colorConverter.style("ALERT", "red", "italic") + ", " +
            colorConverter.style("Database initialized :)", "orange", "bold") +
            colorConverter.style("\nServices connected to API at: ", "green", "italic") +
            colorConverter.style(apiUrl, "brightGreen", "italic")
        );
        if(dbConfig != null) dbConfig.verify();
        if(dbManager != null) dbManager.verify();
        System.out.println("Available databases: " + dataSourceService.getAvailableDatabases());
    }
}