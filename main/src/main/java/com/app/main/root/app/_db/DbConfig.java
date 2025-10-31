package com.app.main.root.app._db;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import javax.sql.DataSource;
import java.util.*;

@Configuration
public class DbConfig {
    public void verify() {
        System.out.println("Database Config initialized...");
    }

    @Bean
    public DbManager dbManager() {
        return new DbManager();
    }

    @Bean
    public Map<String, DataSource> dataSources(DbManager dbManager) {
        return dbManager.initAllDatabases();
    } 

    @Bean Map<String, JdbcTemplate> jdbcTemplates(Map<String, DataSource> dataSources) {
        Map<String, JdbcTemplate> templates = new HashMap<>();
        dataSources.forEach((dbName, source) -> {
            templates.put(dbName, new JdbcTemplate(source));
        });
        return templates;
    }

    @Bean
    public DataSourceService dataSourceService(Map<String, DataSource> dataSources) {
        return new DataSourceService(dataSources);
    }
}