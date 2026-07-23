using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using FreeSql;
using FreeSql.DatabaseModel;

Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
Console.InputEncoding = new UTF8Encoding(false);
Console.OutputEncoding = new UTF8Encoding(false);

var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = false,
};

try
{
    var input = await Console.In.ReadLineAsync();
    if (string.IsNullOrWhiteSpace(input)) throw new InvalidOperationException("数据库请求为空。");
    var request = JsonSerializer.Deserialize<DatabaseRequest>(input, jsonOptions)
        ?? throw new InvalidOperationException("无法解析数据库请求。");

    object? data;
    if (request.Operation == "audit-list")
    {
        data = LoadAuditRecords(request, jsonOptions);
    }
    else
    {
        using var freeSql = CreateFreeSql(request.Profile);
        data = request.Operation switch
        {
            "test" => TestConnection(freeSql, request, jsonOptions),
            "query" => ExecuteSql(freeSql, request, jsonOptions),
            "update-cell" => UpdateCell(freeSql, request, jsonOptions),
            _ => throw new InvalidOperationException($"不支持的数据库操作：{request.Operation}"),
        };
    }

    await Console.Out.WriteAsync(JsonSerializer.Serialize(new DatabaseResponse(true, data, null), jsonOptions));
}
catch (Exception error)
{
    var message = GetErrorMessage(error);
    await Console.Out.WriteAsync(JsonSerializer.Serialize(new DatabaseResponse(false, null, message), jsonOptions));
    Environment.ExitCode = 1;
}

static IFreeSql CreateFreeSql(ConnectionProfile profile)
{
    var (dataType, connectionString) = profile.Kind switch
    {
        "postgres" => (DataType.PostgreSQL,
            $"Host={profile.Host};Port={profile.Port};Database={profile.Database};Username={profile.Username};Password={profile.Password};SSL Mode={PostgresSslMode(profile.SslMode)};Trust Server Certificate=true;Pooling=true;Maximum Pool Size=5"),
        "mysql" => (DataType.MySql,
            $"Server={profile.Host};Port={profile.Port};Database={profile.Database};User ID={profile.Username};Password={profile.Password};SslMode={MySqlSslMode(profile.SslMode)};Pooling=true;MaximumPoolSize=5;AllowUserVariables=true"),
        "sqlserver" => (DataType.SqlServer,
            $"Server={profile.Host},{profile.Port};Database={profile.Database};User ID={profile.Username};Password={profile.Password};Encrypt={SqlServerEncrypt(profile.SslMode)};TrustServerCertificate={profile.SslMode != "require"};Pooling=true;Max Pool Size=5"),
        "sqlite" => (DataType.Sqlite, $"Data Source={profile.Database};Pooling=true"),
        _ => throw new InvalidOperationException($"不支持的数据库类型：{profile.Kind}"),
    };

    return new FreeSqlBuilder()
        .UseConnectionString(dataType, connectionString)
        .UseAutoSyncStructure(false)
        .Build();
}

static object TestConnection(IFreeSql freeSql, DatabaseRequest request, JsonSerializerOptions jsonOptions)
{
    const string sql = "SELECT 1";
    var audit = CreateAudit(request, "ConnectionTest", sql, null, false);
    var stopwatch = Stopwatch.StartNew();
    try
    {
        _ = freeSql.Ado.ExecuteScalar(sql);
        CompleteAudit(audit, stopwatch, true, returnedRows: 1);
        AppendAudit(request, audit, jsonOptions);
        return new { connected = true, audit };
    }
    catch (Exception error)
    {
        CompleteAudit(audit, stopwatch, false, error: GetErrorMessage(error));
        AppendAudit(request, audit, jsonOptions);
        throw;
    }
}

static object ExecuteSql(IFreeSql freeSql, DatabaseRequest request, JsonSerializerOptions jsonOptions)
{
    if (string.IsNullOrWhiteSpace(request.Sql)) throw new InvalidOperationException("SQL 不能为空。");
    var sql = request.Sql.Trim();
    var operation = ClassifySql(sql);
    var highRisk = IsHighRisk(operation);
    var parameters = ConvertParameters(request.Parameters);
    var audit = CreateAudit(request, operation, sql, parameters, highRisk);
    var stopwatch = Stopwatch.StartNew();
    BackupResult? backup = null;

    try
    {
        if (highRisk)
        {
            EnsureSingleHighRiskStatement(sql);
            var target = ExtractHighRiskTable(sql, operation)
                ?? throw new InvalidOperationException("无法安全识别高危 SQL 的目标表，已阻止执行。请拆分为单条标准 SQL 后重试。");
            var table = ResolveTable(freeSql, target);
            if (RequiresMissingWhereConfirmation(operation, sql) && !request.ConfirmWithoutWhere)
            {
                var confirmationMessage = operation is "Truncate" or "DropTable"
                    ? $"{operation} 将作用于整张表 {QualifiedTableName(table)}。"
                    : $"{operation} 语句没有检测到 WHERE 条件，可能影响整张表 {QualifiedTableName(table)}。";
                audit.Error = $"{confirmationMessage} 等待用户确认。";
                CompleteAudit(audit, stopwatch, false, error: audit.Error);
                AppendAudit(request, audit, jsonOptions);
                return new
                {
                    confirmation = new SqlConfirmation("missing-where", "高危 SQL 缺少 WHERE 条件", $"{confirmationMessage} 是否确认继续执行？"),
                    audit,
                };
            }
            audit.ConfirmedWithoutWhere = RequiresMissingWhereConfirmation(operation, sql) && request.ConfirmWithoutWhere;
            var affectedRows = 0;
            if (request.AllowWithoutBackup)
            {
                audit.BackupSkipped = true;
                affectedRows = freeSql.Ado.ExecuteNonQuery(sql, parameters.Count == 0 ? null : parameters);
            }
            else
            {
                try
                {
                    freeSql.Ado.Transaction(() =>
                    {
                        backup = BackupWholeTable(freeSql, request, audit.Id, table, operation, jsonOptions);
                        affectedRows = freeSql.Ado.ExecuteNonQuery(sql, parameters.Count == 0 ? null : parameters);
                    });
                }
                catch (Exception backupError) when (backup is null)
                {
                    audit.BackupError = GetErrorMessage(backupError);
                    CompleteAudit(audit, stopwatch, false, error: $"自动备份失败：{audit.BackupError}");
                    AppendAudit(request, audit, jsonOptions);
                    return new
                    {
                        confirmation = new SqlConfirmation(
                            "backup-failed",
                            "自动备份失败",
                            $"执行前备份失败：{audit.BackupError}。是否确认在没有备份的情况下继续执行？"),
                        audit,
                    };
                }
            }
            ApplyBackup(audit, backup);
            CompleteAudit(audit, stopwatch, true, affectedRows: affectedRows);
            AppendAudit(request, audit, jsonOptions);
            return new { rows = Array.Empty<object>(), affectedRows, audit };
        }

        if (IsReadOperation(operation))
        {
            var rows = freeSql.Ado.Query<dynamic>(sql, parameters.Count == 0 ? null : parameters);
            var editable = GetQueryEditMetadata(freeSql, sql, rows);
            CompleteAudit(audit, stopwatch, true, returnedRows: rows.Count);
            AppendAudit(request, audit, jsonOptions);
            return new { rows, affectedRows = (long?)null, editable, audit };
        }

        var changedRows = freeSql.Ado.ExecuteNonQuery(sql, parameters.Count == 0 ? null : parameters);
        CompleteAudit(audit, stopwatch, true, affectedRows: changedRows);
        AppendAudit(request, audit, jsonOptions);
        return new { rows = Array.Empty<object>(), affectedRows = changedRows, audit };
    }
    catch (Exception error)
    {
        ApplyBackup(audit, backup);
        CompleteAudit(audit, stopwatch, false, error: GetErrorMessage(error));
        AppendAudit(request, audit, jsonOptions);
        throw;
    }
}

static object UpdateCell(IFreeSql freeSql, DatabaseRequest request, JsonSerializerOptions jsonOptions)
{
    if (string.IsNullOrWhiteSpace(request.Table)) throw new InvalidOperationException("缺少结果集来源表。");
    if (string.IsNullOrWhiteSpace(request.Column)) throw new InvalidOperationException("缺少要修改的列。");
    var table = ResolveTable(freeSql, request.Table);
    var column = table.Columns.FirstOrDefault(item => item.Name.Equals(request.Column, StringComparison.OrdinalIgnoreCase))
        ?? throw new InvalidOperationException($"列 {request.Column} 不属于表 {table.Name}。");
    if (column.IsPrimary) throw new InvalidOperationException("主键列不允许在结果表格中修改。");
    if (table.Primarys.Count == 0) throw new InvalidOperationException($"表 {table.Name} 没有主键，无法安全更新结果行。");

    var primaryValues = request.PrimaryKeyValues ?? new Dictionary<string, JsonElement>();
    var missingPrimaryKeys = table.Primarys.Where(primary => !primaryValues.Keys.Any(key => key.Equals(primary.Name, StringComparison.OrdinalIgnoreCase))).ToArray();
    if (missingPrimaryKeys.Length > 0)
        throw new InvalidOperationException($"结果中缺少主键列：{string.Join(", ", missingPrimaryKeys.Select(item => item.Name))}。");

    var quotedTable = QuoteTable(request.Profile.Kind, table);
    var quotedColumn = QuoteIdentifier(request.Profile.Kind, column.Name);
    var parameters = new Dictionary<string, object?> { ["value"] = ConvertJsonValue(request.Value) };
    var predicates = new List<string>();
    for (var index = 0; index < table.Primarys.Count; index += 1)
    {
        var primary = table.Primarys[index];
        var pair = primaryValues.First(item => item.Key.Equals(primary.Name, StringComparison.OrdinalIgnoreCase));
        var parameterName = $"pk{index}";
        parameters[parameterName] = ConvertJsonValue(pair.Value);
        predicates.Add($"{QuoteIdentifier(request.Profile.Kind, primary.Name)} = @{parameterName}");
    }

    var where = string.Join(" AND ", predicates);
    var selectSql = $"SELECT * FROM {quotedTable} WHERE {where}";
    var updateSql = $"UPDATE {quotedTable} SET {quotedColumn} = @value WHERE {where}";
    var audit = CreateAudit(request, "CellUpdate", updateSql, parameters, true);
    var stopwatch = Stopwatch.StartNew();
    BackupResult? backup = null;
    var affectedRows = 0;

    try
    {
        if (request.AllowWithoutBackup)
        {
            audit.BackupSkipped = true;
            freeSql.Ado.Transaction(() =>
            {
                affectedRows = freeSql.Ado.ExecuteNonQuery(updateSql, parameters);
                if (affectedRows != 1)
                    throw new InvalidOperationException($"更新影响了 {affectedRows} 行，事务已回滚。");
            });
        }
        else
        {
            try
            {
                freeSql.Ado.Transaction(() =>
                {
                    var backupRows = freeSql.Ado.Query<dynamic>(selectSql, parameters);
                    if (backupRows.Count != 1)
                        throw new InvalidOperationException($"主键条件匹配到 {backupRows.Count} 行，已阻止更新。");
                    backup = WriteBackup(request, audit.Id, table, "CellUpdate", backupRows, jsonOptions);
                    affectedRows = freeSql.Ado.ExecuteNonQuery(updateSql, parameters);
                    if (affectedRows != 1)
                        throw new InvalidOperationException($"更新影响了 {affectedRows} 行，事务已回滚。");
                });
            }
            catch (Exception backupError) when (backup is null)
            {
                audit.BackupError = GetErrorMessage(backupError);
                CompleteAudit(audit, stopwatch, false, error: $"自动备份失败：{audit.BackupError}");
                AppendAudit(request, audit, jsonOptions);
                return new
                {
                    confirmation = new SqlConfirmation(
                        "backup-failed",
                        "自动备份失败",
                        $"更新前备份失败：{audit.BackupError}。是否确认在没有备份的情况下继续更新？"),
                    audit,
                };
            }
        }
        ApplyBackup(audit, backup);
        CompleteAudit(audit, stopwatch, true, affectedRows: affectedRows);
        AppendAudit(request, audit, jsonOptions);
        return new { rows = Array.Empty<object>(), affectedRows, audit };
    }
    catch (Exception error)
    {
        ApplyBackup(audit, backup);
        CompleteAudit(audit, stopwatch, false, error: GetErrorMessage(error));
        AppendAudit(request, audit, jsonOptions);
        throw;
    }
}

static QueryEditMetadata? GetQueryEditMetadata(IFreeSql freeSql, string sql, IReadOnlyList<dynamic> rows)
{
    if (rows.Count == 0) return null;
    var source = ExtractSimpleSelectTable(sql);
    if (source is null) return null;
    DbTableInfo table;
    try { table = ResolveTable(freeSql, source); }
    catch { return null; }
    if (table.Primarys.Count == 0) return null;

    var json = JsonSerializer.SerializeToElement((object)rows[0]);
    if (json.ValueKind != JsonValueKind.Object) return null;
    var resultColumns = json.EnumerateObject().Select(property => property.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
    if (table.Primarys.Any(primary => !resultColumns.Contains(primary.Name))) return null;

    return new QueryEditMetadata(
        QualifiedTableName(table),
        table.Primarys.Select(primary => primary.Name).ToArray(),
        table.Columns.Select(column => column.Name).ToArray());
}

static BackupResult BackupWholeTable(
    IFreeSql freeSql,
    DatabaseRequest request,
    string auditId,
    DbTableInfo table,
    string operation,
    JsonSerializerOptions jsonOptions)
{
    var rows = freeSql.Ado.Query<dynamic>($"SELECT * FROM {QuoteTable(request.Profile.Kind, table)}");
    return WriteBackup(request, auditId, table, operation, rows, jsonOptions);
}

static BackupResult WriteBackup(
    DatabaseRequest request,
    string auditId,
    DbTableInfo table,
    string operation,
    IReadOnlyList<dynamic> rows,
    JsonSerializerOptions jsonOptions)
{
    var now = DateTimeOffset.UtcNow;
    var root = StorageRoot(request);
    var directory = Path.Combine(root, "backups", now.ToString("yyyy"), now.ToString("MM"), now.ToString("dd"));
    Directory.CreateDirectory(directory);
    var safeTable = Regex.Replace(table.Name, @"[^\p{L}\p{N}_-]+", "_");
    var fileName = $"{now:yyyyMMdd-HHmmss-fff}-{safeTable}-{auditId}.json";
    var path = Path.Combine(directory, fileName);
    var temporaryPath = $"{path}.tmp";
    var envelope = new BackupEnvelope(
        auditId,
        operation,
        request.Profile.Id,
        request.Profile.Name,
        request.Profile.Kind,
        request.Profile.Database,
        QualifiedTableName(table),
        now,
        rows.Count,
        rows);
    var content = JsonSerializer.Serialize(envelope, new JsonSerializerOptions(jsonOptions) { WriteIndented = true });
    using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
    using (var writer = new StreamWriter(stream, new UTF8Encoding(false)))
    {
        writer.Write(content);
        writer.Flush();
        stream.Flush(true);
    }
    File.Move(temporaryPath, path, true);
    return new BackupResult(path, rows.Count, QualifiedTableName(table));
}

static void AppendAudit(DatabaseRequest request, SqlAuditRecord audit, JsonSerializerOptions jsonOptions)
{
    var root = StorageRoot(request);
    var directory = Path.Combine(root, "audit");
    Directory.CreateDirectory(directory);
    var path = Path.Combine(directory, $"{audit.StartedAt:yyyy-MM-dd}.jsonl");
    var line = JsonSerializer.Serialize(audit, jsonOptions) + Environment.NewLine;
    for (var attempt = 0; attempt < 8; attempt += 1)
    {
        try
        {
            using var stream = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.Read);
            using var writer = new StreamWriter(stream, new UTF8Encoding(false));
            writer.Write(line);
            writer.Flush();
            stream.Flush(true);
            return;
        }
        catch (IOException) when (attempt < 7)
        {
            Thread.Sleep(20 * (attempt + 1));
        }
    }
}

static AuditPage LoadAuditRecords(DatabaseRequest request, JsonSerializerOptions jsonOptions)
{
    var directory = Path.Combine(StorageRoot(request), "audit");
    if (!Directory.Exists(directory)) return new AuditPage(Array.Empty<SqlAuditRecord>(), 0);
    var limit = Math.Clamp(request.Limit <= 0 ? 20 : request.Limit, 1, 200);
    var offset = Math.Max(0, request.Offset);
    var result = new List<SqlAuditRecord>(limit);
    var total = 0;
    foreach (var file in Directory.EnumerateFiles(directory, "*.jsonl").OrderByDescending(path => path))
    {
        var lines = File.ReadLines(file, Encoding.UTF8).Reverse();
        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            try
            {
                var audit = JsonSerializer.Deserialize<SqlAuditRecord>(line, jsonOptions);
                if (audit is null) continue;
                if (!string.IsNullOrWhiteSpace(request.Profile.Id) && audit.ConnectionId != request.Profile.Id) continue;
                total += 1;
                if (total <= offset || result.Count >= limit) continue;
                audit.ConnectionName = RepairLegacyMojibake(audit.ConnectionName);
                result.Add(audit);
            }
            catch (JsonException)
            {
                // 单条损坏日志不影响其它审计记录读取。
            }
        }
    }
    return new AuditPage(result, total);
}

static string RepairLegacyMojibake(string value)
{
    if (string.IsNullOrWhiteSpace(value) || !Regex.IsMatch(value, "[€寮鍙戝簱锛鈥]"))
        return value;
    try
    {
        var legacyBytes = Encoding.GetEncoding(936).GetBytes(value);
        return new UTF8Encoding(false, true).GetString(legacyBytes);
    }
    catch (DecoderFallbackException)
    {
        return value;
    }
}

static SqlAuditRecord CreateAudit(
    DatabaseRequest request,
    string operation,
    string sql,
    IReadOnlyDictionary<string, object?>? parameters,
    bool highRisk) => new()
{
    Id = Guid.NewGuid().ToString("N"),
    Operation = operation,
    ConnectionId = request.Profile.Id,
    ConnectionName = request.Profile.Name,
    DatabaseKind = request.Profile.Kind,
    Host = request.Profile.Host,
    Port = request.Profile.Port,
    Database = request.Profile.Database,
    Username = request.Profile.Username,
    Sql = sql,
    Parameters = parameters is null ? null : new Dictionary<string, object?>(parameters),
    HighRisk = highRisk,
    StartedAt = DateTimeOffset.UtcNow,
};

static void CompleteAudit(
    SqlAuditRecord audit,
    Stopwatch stopwatch,
    bool success,
    int? affectedRows = null,
    int? returnedRows = null,
    string? error = null)
{
    stopwatch.Stop();
    audit.FinishedAt = DateTimeOffset.UtcNow;
    audit.DurationMs = Math.Max(0, stopwatch.ElapsedMilliseconds);
    audit.Success = success;
    audit.AffectedRows = affectedRows;
    audit.ReturnedRows = returnedRows;
    audit.Error = error;
}

static void ApplyBackup(SqlAuditRecord audit, BackupResult? backup)
{
    if (backup is null) return;
    audit.BackupPath = backup.Path;
    audit.BackupRowCount = backup.RowCount;
    audit.BackupTable = backup.Table;
}

static Dictionary<string, object?> ConvertParameters(Dictionary<string, JsonElement>? parameters)
{
    if (parameters is null) return new Dictionary<string, object?>();
    return parameters.ToDictionary(pair => pair.Key, pair => ConvertJsonValue(pair.Value));
}

static object? ConvertJsonValue(JsonElement value) => value.ValueKind switch
{
    JsonValueKind.Null or JsonValueKind.Undefined => null,
    JsonValueKind.String when value.TryGetDateTimeOffset(out var dateTime) => dateTime,
    JsonValueKind.String => value.GetString(),
    JsonValueKind.Number when value.TryGetInt64(out var integer) => integer,
    JsonValueKind.Number when value.TryGetDecimal(out var number) => number,
    JsonValueKind.True => true,
    JsonValueKind.False => false,
    _ => value.GetRawText(),
};

static DbTableInfo ResolveTable(IFreeSql freeSql, string identifier)
{
    var normalized = NormalizeIdentifier(identifier);
    var table = freeSql.DbFirst.GetTableByName(normalized, true);
    if (table is null && normalized.Contains('.'))
        table = freeSql.DbFirst.GetTableByName(normalized.Split('.').Last(), true);
    return table ?? throw new InvalidOperationException($"数据库中不存在表 {normalized}，已阻止执行。");
}

static string? ExtractSimpleSelectTable(string sql)
{
    var normalized = StripLeadingComments(sql).Trim();
    if (!Regex.IsMatch(normalized, @"^select\b", RegexOptions.IgnoreCase)) return null;
    if (Regex.IsMatch(normalized, @"\b(distinct|join|union|intersect|except|group\s+by)\b", RegexOptions.IgnoreCase)) return null;
    if (HasMultipleStatements(normalized)) return null;
    var identifier = IdentifierPattern();
    var match = Regex.Match(normalized, $@"\bfrom\s+(?<table>{identifier})", RegexOptions.IgnoreCase);
    return match.Success ? NormalizeIdentifier(match.Groups["table"].Value) : null;
}

static string? ExtractHighRiskTable(string sql, string operation)
{
    var normalized = StripLeadingComments(sql).Trim();
    var identifier = IdentifierPattern();
    var pattern = operation switch
    {
        "Update" => $@"^update\s+(?<table>{identifier})\s+set\b",
        "Delete" => $@"^delete\s+from\s+(?<table>{identifier})(?:\s|;|$)",
        "Truncate" => $@"^truncate\s+(?:table\s+)?(?<table>{identifier})(?:\s|;|$)",
        "DropTable" => $@"^drop\s+table\s+(?:if\s+exists\s+)?(?<table>{identifier})(?:\s|;|$)",
        "AlterTable" => $@"^alter\s+table\s+(?<table>{identifier})(?:\s|;|$)",
        "Merge" => $@"^merge\s+(?:into\s+)?(?<table>{identifier})(?:\s|;|$)",
        _ => "",
    };
    if (string.IsNullOrEmpty(pattern)) return null;
    var match = Regex.Match(normalized, pattern, RegexOptions.IgnoreCase);
    return match.Success ? NormalizeIdentifier(match.Groups["table"].Value) : null;
}

static string ClassifySql(string sql)
{
    var normalized = StripLeadingComments(sql).TrimStart();
    if (Regex.IsMatch(normalized, @"^with\b", RegexOptions.IgnoreCase))
    {
        if (Regex.IsMatch(normalized, @"\bdelete\b", RegexOptions.IgnoreCase)) return "Delete";
        if (Regex.IsMatch(normalized, @"\bupdate\b", RegexOptions.IgnoreCase)) return "Update";
        if (Regex.IsMatch(normalized, @"\bmerge\b", RegexOptions.IgnoreCase)) return "Merge";
        if (Regex.IsMatch(normalized, @"\binsert\b", RegexOptions.IgnoreCase)) return "Insert";
        return "Select";
    }
    if (Regex.IsMatch(normalized, @"^select\b", RegexOptions.IgnoreCase)) return "Select";
    if (Regex.IsMatch(normalized, @"^(show|describe|desc|explain|pragma)\b", RegexOptions.IgnoreCase)) return "Metadata";
    if (Regex.IsMatch(normalized, @"^update\b", RegexOptions.IgnoreCase)) return "Update";
    if (Regex.IsMatch(normalized, @"^delete\b", RegexOptions.IgnoreCase)) return "Delete";
    if (Regex.IsMatch(normalized, @"^truncate\b", RegexOptions.IgnoreCase)) return "Truncate";
    if (Regex.IsMatch(normalized, @"^drop\s+table\b", RegexOptions.IgnoreCase)) return "DropTable";
    if (Regex.IsMatch(normalized, @"^alter\s+table\b", RegexOptions.IgnoreCase)) return "AlterTable";
    if (Regex.IsMatch(normalized, @"^merge\b", RegexOptions.IgnoreCase)) return "Merge";
    if (Regex.IsMatch(normalized, @"^insert\b", RegexOptions.IgnoreCase)) return "Insert";
    if (Regex.IsMatch(normalized, @"^(create|drop|alter)\b", RegexOptions.IgnoreCase)) return "Ddl";
    return "Execute";
}

static bool IsReadOperation(string operation) => operation is "Select" or "Metadata";
static bool IsHighRisk(string operation) => operation is "Update" or "Delete" or "Truncate" or "DropTable" or "AlterTable" or "Merge";
static bool RequiresMissingWhereConfirmation(string operation, string sql) =>
    operation is "Truncate" or "DropTable"
    || operation is "Update" or "Delete" && !Regex.IsMatch(sql, @"\bwhere\b", RegexOptions.IgnoreCase);

static void EnsureSingleHighRiskStatement(string sql)
{
    if (HasMultipleStatements(sql))
        throw new InvalidOperationException("高危操作一次只允许执行一条 SQL，已阻止执行。");
}

static bool HasMultipleStatements(string sql)
{
    var trimmed = sql.Trim();
    if (trimmed.EndsWith(';')) trimmed = trimmed[..^1];
    return trimmed.Contains(';');
}

static string StripLeadingComments(string sql)
{
    var current = sql;
    while (true)
    {
        var next = Regex.Replace(current, @"^\s*(?:--[^\r\n]*(?:\r?\n|$)|/\*[\s\S]*?\*/)", "", RegexOptions.Singleline);
        if (next == current) return next;
        current = next;
    }
}

static string IdentifierPattern()
{
    const string part = @"(?:\[[^\]]+\]|`[^`]+`|""[^""]+""|[A-Za-z_][A-Za-z0-9_$]*)";
    return $@"{part}(?:\s*\.\s*{part}){{0,2}}";
}

static string NormalizeIdentifier(string identifier) => string.Join(
    ".",
    identifier.Split('.').Select(part => part.Trim()).Select(UnquoteIdentifier));

static string UnquoteIdentifier(string value)
{
    if (value.Length >= 2 && value[0] == '[' && value[^1] == ']') return value[1..^1].Replace("]]", "]");
    if (value.Length >= 2 && value[0] == '`' && value[^1] == '`') return value[1..^1].Replace("``", "`");
    if (value.Length >= 2 && value[0] == '"' && value[^1] == '"') return value[1..^1].Replace("\"\"", "\"");
    return value;
}

static string QuoteIdentifier(string kind, string identifier) => kind switch
{
    "mysql" => $"`{identifier.Replace("`", "``")}`",
    "sqlserver" => $"[{identifier.Replace("]", "]]")}]",
    _ => $"\"{identifier.Replace("\"", "\"\"")}\"",
};

static string QuoteTable(string kind, DbTableInfo table)
{
    var parts = new List<string>();
    if (!string.IsNullOrWhiteSpace(table.Schema)) parts.Add(QuoteIdentifier(kind, table.Schema));
    parts.Add(QuoteIdentifier(kind, table.Name));
    return string.Join(".", parts);
}

static string QualifiedTableName(DbTableInfo table) =>
    string.IsNullOrWhiteSpace(table.Schema) ? table.Name : $"{table.Schema}.{table.Name}";

static string StorageRoot(DatabaseRequest request)
{
    var root = string.IsNullOrWhiteSpace(request.StoragePath)
        ? Path.Combine(AppContext.BaseDirectory, "data")
        : request.StoragePath;
    Directory.CreateDirectory(root);
    return root;
}

static string PostgresSslMode(string mode) => mode switch
{
    "disable" => "Disable",
    "require" => "Require",
    _ => "Prefer",
};

static string MySqlSslMode(string mode) => mode switch
{
    "disable" => "None",
    "require" => "Required",
    _ => "Preferred",
};

static string SqlServerEncrypt(string mode) => mode switch
{
    "disable" => "False",
    "require" => "True",
    _ => "Optional",
};

static string GetErrorMessage(Exception error)
{
    var messages = new List<string>();
    for (var current = error; current is not null; current = current.InnerException)
    {
        if (!string.IsNullOrWhiteSpace(current.Message) && !messages.Contains(current.Message))
            messages.Add(current.Message);
    }
    return string.Join(" → ", messages);
}

internal sealed record ConnectionProfile(
    string Id,
    string Name,
    string Kind,
    string Host,
    int Port,
    string Database,
    string Username,
    string Password,
    string SslMode);

internal sealed record DatabaseRequest(
    string Operation,
    ConnectionProfile Profile,
    string Sql = "",
    Dictionary<string, JsonElement>? Parameters = null,
    string Table = "",
    string Column = "",
    JsonElement Value = default,
    Dictionary<string, JsonElement>? PrimaryKeyValues = null,
    string StoragePath = "",
    int Limit = 20,
    int Offset = 0,
    bool ConfirmWithoutWhere = false,
    bool AllowWithoutBackup = false);

internal sealed record DatabaseResponse(bool Ok, object? Data, string? Error);
internal sealed record SqlConfirmation(string Type, string Title, string Message);
internal sealed record QueryEditMetadata(string Table, IReadOnlyList<string> PrimaryKeys, IReadOnlyList<string> Columns);
internal sealed record BackupResult(string Path, int RowCount, string Table);
internal sealed record AuditPage(IReadOnlyList<SqlAuditRecord> Items, int Total);
internal sealed record BackupEnvelope(
    string AuditId,
    string Operation,
    string ConnectionId,
    string ConnectionName,
    string DatabaseKind,
    string Database,
    string Table,
    DateTimeOffset CreatedAt,
    int RowCount,
    IReadOnlyList<dynamic> Rows);

internal sealed class SqlAuditRecord
{
    public string Id { get; set; } = "";
    public string Operation { get; set; } = "";
    public string ConnectionId { get; set; } = "";
    public string ConnectionName { get; set; } = "";
    public string DatabaseKind { get; set; } = "";
    public string Host { get; set; } = "";
    public int Port { get; set; }
    public string Database { get; set; } = "";
    public string Username { get; set; } = "";
    public string Sql { get; set; } = "";
    public Dictionary<string, object?>? Parameters { get; set; }
    public bool HighRisk { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset FinishedAt { get; set; }
    public long DurationMs { get; set; }
    public bool Success { get; set; }
    public int? AffectedRows { get; set; }
    public int? ReturnedRows { get; set; }
    public string? Error { get; set; }
    public string? BackupPath { get; set; }
    public int? BackupRowCount { get; set; }
    public string? BackupTable { get; set; }
    public bool BackupSkipped { get; set; }
    public string? BackupError { get; set; }
    public bool ConfirmedWithoutWhere { get; set; }
}
