package com.app.main.root.app._db;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.*;

@Component
public class DataSourceService {
    private final Map<String, DataSource> dataSources;

    public DataSourceService(Map<String, DataSource> dataSources) {
        this.dataSources = dataSources;
    }

    public DataSource getDataSource(String serviceName) {
        DataSource dataSource = dataSources.get(serviceName);
        if(dataSource == null) throw new IllegalArgumentException("No database found for service: " + serviceName);
        return dataSource;
    }

    public Set<String> getAvailableDatabases() {
        return dataSources.keySet();
    }

    public DataSource setDb(String name) {
        return getDataSource(name);
    }
}
