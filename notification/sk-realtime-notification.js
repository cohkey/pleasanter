/**
 * 変更履歴
 * 2026/11/06
 * ・お客さまサービスグループ指定時に同店所の第一・第二・第三グループも検索し、組織コードを重複排除
 * ・通知対象・組織検索の分類フィルタを配列形式に修正し、組織未取得時の件数を記録
 * ・通知ログの空行と区切り線前の余分な改行を削除
 * ・通知IDごとの区切りと条件一覧を整え、重複するデバッグログを削除
 * 2026/11/05
 * ・複数値を文字列比較するIN・NOT_IN演算子と比較値の設定検証を追加
 * ・通知条件を親ルールIDで絞り込み、別通知IDの条件が混在する問題を修正
 */

// ・新規追加

const SITE_IDS = {
    conditions: 843614,
    rules: 843610,
    targets: 843620,
    organizations: 846822,
    mailSettings: 809267
}

function getNotificationFields() {
    const NOTIFICATION_FIELDS = {
        status: "ClassB", // ステータス小項目
        tenshoCode: "ClassD", // 店所コード
        denatsu: "ClassE", // 電圧
    }

    function getChangedFields() {
        const changedFields = {};

        for (const [fieldName, columnName] of Object.entries(NOTIFICATION_FIELDS)) {
            const oldValue = saved[columnName];
            const newValue = model[columnName];

            if (String(oldValue ?? "") != String(newValue ?? "")) {
                changedFields[fieldName] = {
                    oldValue,
                    newValue
                };
            }
        }

        return changedFields;
    }

    context.UserData.notificationData = JSON.stringify({
        changedFields: getChangedFields()
    });
}

function getNotificationRules(notificationRuleIds) {
    const notificationRules = [];

    for (const ruleId of notificationRuleIds) {
        const records = Array.from(items.Get(Number(ruleId)));

        if (records.length === 0) {
            context.Log(`通知ルールが見つかりません: ${ruleId}`);
            continue;
        }

        const rule = records[0];

        // 無効な通知ルールは除外
        if (rule.CheckA !== true) {
            continue;
        }

        notificationRules.push(rule);
    }

    return notificationRules;
}

function getRelatedConditions(changedFieldNames) {
    if (changedFieldNames.length === 0) {
        return [];
    }

    const data = {
        View: {
            ColumnFilterHash: {
                ClassC: JSON.stringify(changedFieldNames)
            },
            ColumnFilterSearchTypes: {
                ClassC: "ExactMatchMultiple"
            }
        }
    };

    const records = Array.from(items.Get(
        843614,
        JSON.stringify(data)
    ));

    // 通知の基点となる判定方法
    const triggerOperators = ["CHANGED", "TO", "FROM_TO"];

    return records.filter(record => {
        return (
            changedFieldNames.includes(String(record.ClassC)) &&
            triggerOperators.includes(String(record.ClassD))
        );
    });
}

function getNotificationConditions(ruleId) {
    const data = {
        View: {
            ColumnFilterHash: {
                ClassA: JSON.stringify([String(ruleId)])
            },
            ColumnFilterSearchTypes: {
                ClassA: "ExactMatchMultiple"
            }
        }
    };

    return Array.from(items.Get(
        843614,
        JSON.stringify(data)
    )).filter(condition =>
        String(condition.ClassA) === String(ruleId)
    );
}

/**
 * FROM_TOの比較値を変更前・変更後の文字列に分解する。
 * 空値・区切り不足・区切り過多は通知条件の設定エラーとする。
 */
function parseFromToComparison(value) {
    const values = value.split(",").map(part => part.trim());

    if (values.length !== 2 || values.some(part => part === "")) {
        throw new Error(`FROM_TOの比較値が不正です（変更前,変更後を指定）: ${value}`);
    }

    return values;
}

/**
 * IN・NOT_INの比較値を2個以上の空でない文字列に分解する。
 */
function parseMultipleComparisonValues(value, operator) {
    const values = value.split(",").map(part => part.trim());

    if (values.length < 2 || values.some(part => part === "")) {
        throw new Error(`${operator}の比較値が不正です（カンマ区切りで2個以上の値を指定）: ${value}`);
    }

    return values;
}

function evaluateCondition(condition, changedFields) {
    const field = String(condition.ClassC);
    const operator = String(condition.ClassD);
    const value = String(condition.DescriptionB ?? "");

    const fieldMap = {
        status: "ClassB",
        tenshoCode: "ClassD",
        denatsu: "ClassE"
    };

    const columnName = fieldMap[field];

    if (!columnName) {
        throw new Error(`未対応の対象項目: ${field}`);
    }

    const change = changedFields[field];
    const newValue = String(model[columnName] ?? "");

    context.Log(JSON.stringify({
        field,
        operator,
        value,
        columnName,
        modelValue: newValue,
        changedValue: change?.newValue,
        hasChange: change !== undefined
    }));

    switch (operator) {
        case "CHANGED":
            return change !== undefined;

        case "TO":
            return change !== undefined &&
                String(change.newValue ?? "") === value;

        case "FROM_TO": {
            const [fromValue, toValue] = parseFromToComparison(value);

            return change !== undefined &&
                String(change.oldValue ?? "") === fromValue &&
                String(change.newValue ?? "") === toValue &&
                fromValue !== toValue;
        }

        case "EQ":
            return newValue === value;

        case "NE":
            return newValue !== value;

        case "IN":
        case "NOT_IN": {
            const values = parseMultipleComparisonValues(value, operator);
            const included = values.includes(newValue);

            return operator === "IN" ? included : !included;
        }

        case "GE":
            return newValue !== "" &&
                value !== "" &&
                Number.isFinite(Number(newValue)) &&
                Number.isFinite(Number(value)) &&
                Number(newValue) >= Number(value);

        case "LE":
            return newValue !== "" &&
                value !== "" &&
                Number.isFinite(Number(newValue)) &&
                Number.isFinite(Number(value)) &&
                Number(newValue) <= Number(value);

        default:
            throw new Error(`未対応の判定方法: ${operator}`);
    }
}

function evaluateConditions(conditions, changedFields) {
    if (conditions.length === 0) {
        return false;
    }

    const patterns = {};

    for (const condition of conditions) {
        // AND/ORの短絡評価で比較値の設定エラーが隠れないよう事前検証する。
        const operator = String(condition.ClassD);
        if (operator === "FROM_TO") {
            parseFromToComparison(String(condition.DescriptionB ?? ""));
        } else if (operator === "IN" || operator === "NOT_IN") {
            parseMultipleComparisonValues(String(condition.DescriptionB ?? ""), operator);
        }

        const pattern = String(condition.ClassB || "1");

        if (!patterns[pattern]) {
            patterns[pattern] = [];
        }

        patterns[pattern].push(condition);
    }

    return Object.values(patterns).some(conditionsInPattern =>
        conditionsInPattern.every(condition =>
            evaluateCondition(condition, changedFields)
        )
    );
}

function getNotificationTargets(ruleId) {
    const data = {
        View: {
            ColumnFilterHash: {
                ClassA: JSON.stringify([String(ruleId)])
            },
            ColumnFilterSearchTypes: {
                ClassA: "ExactMatchMultiple"
            }
        }
    };

    const records = Array.from(items.Get(
        SITE_IDS.targets,
        JSON.stringify(data)
    ));

    // 親レコードIDが一致するものだけ取得
    return records
        .filter(record =>
            String(record.ClassA) === String(ruleId)
        )
        .map(record => ({
            group: String(record.ClassB ?? ""),
            addressType: String(record.ClassC ?? "")
        }));
}

// 親グループを指定した場合だけ、明示したグループへ検索を展開する。
const NOTIFICATION_GROUP_EXPANSIONS = {
    "お客さまサービスグループ": [
        "お客さまサービスグループ",
        "お客さまサービス第一グループ",
        "お客さまサービス第二グループ",
        "お客さまサービス第三グループ"
    ]
};

function getOrganizationCodes(tenshoCode, groupCode) {
    const groupName = String(groupCode);
    const groupCodes = Object.prototype.hasOwnProperty.call(NOTIFICATION_GROUP_EXPANSIONS, groupName)
        ? NOTIFICATION_GROUP_EXPANSIONS[groupName]
        : [groupName];
    const data = {
        View: {
            ColumnFilterHash: {
                ClassA: JSON.stringify([String(tenshoCode)]),
                ClassC: JSON.stringify(groupCodes)
            },
            ColumnFilterSearchTypes: {
                ClassA: "ExactMatchMultiple",
                ClassC: "ExactMatchMultiple"
            }
        }
    };

    const records = Array.from(items.Get(
        SITE_IDS.organizations,
        JSON.stringify(data)
    ));

    const matchedRecords = records
        .filter(record =>
            String(record.ClassA) === String(tenshoCode) &&
            groupCodes.includes(String(record.ClassC))
        );
    const organizationCodes = [...new Set(matchedRecords
        .map(record => String(record.DescriptionA ?? ""))
        .filter(Boolean))];

    if (organizationCodes.length === 0) {
        context.Log(`組織検索: 取得${records.length}件 / 条件一致${matchedRecords.length}件 / 組織コードあり0件`);
    }

    return organizationCodes;
}

const MAIL_SETTING_FIELDS = {
    organizationCode: "DescriptionB",
    notificationUsers: "ClassZ",
    emailAddresses: "DescriptionA"
};

// 組織コードに紐づくメール通知設定を取得
function getMailRecipients(organizationCode) {
    const field = MAIL_SETTING_FIELDS.organizationCode;

    const data = {
        View: {
            ColumnFilterHash: {
                [field]: String(organizationCode)
            },
            ColumnFilterSearchTypes: {
                [field]: "ExactMatch"
            }
        }
    }

    const records = Array.from(items.Get(
        SITE_IDS.mailSettings,
        JSON.stringify(data)
    ));

    for (const record of records) {
        const rawValue = record.DescriptionA;
        const convertedValue = String(rawValue ?? "");
    }

    return records
        .filter(record =>
            String(record[field] ?? "") === String(organizationCode)
        )
        .map(record => ({
            organizationCode: String(record[field] ?? ""),
            notificationUsers: String(record[MAIL_SETTING_FIELDS.notificationUsers] ?? ""),
            emailAddresses: String(record[MAIL_SETTING_FIELDS.emailAddresses] ?? "")
        }));
}

function parseNotificationUsers(value) {
    if (!value) {
        return [];
    }

    const userIds = JSON.parse(String(value));

    if (!Array.isArray(userIds)) {
        throw new Error("通知先ユーザの形式が不正です");
    }

    return userIds.map(id => String(id).trim())
        .filter(id => /^\d+$/.test(id));
}

function parseMailAddresses(value) {
    if (!value) {
        return [];
    }

    const addresses = String(value)
        .split(/[,;\r\n]+/)
        .map(address => address.trim())
        .filter(Boolean);

    // 明らかに不正なアドレスを検出
    for (const address of addresses) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
            context.Log(`不正なメールアドレス: ${JSON.stringify(address)}`);
            throw new Error("メールアドレスの形式が不正です。");
        }
    }

    return addresses;
}

function createRecipientAddresses(mailRecipients) {
    const addresses = [];

    for (const recipient of mailRecipients) {
        const userIds = parseNotificationUsers(recipient.notificationUsers);

        // Pleasanterのユーザ宛先形式
        for (const userId of userIds) {
            addresses.push(`[User${userId}]`);
        }

        // 直接指定されたメールアドレス
        const mailAddresses = parseMailAddresses(recipient.emailAddresses);

        addresses.push(...mailAddresses);
    }

    return addresses;
}

function removeDuplicateRecipients(recipients) {
    const used = new Set();

    for (const type of ["To", "Cc", "Bcc"]) {
        recipients[type] = recipients[type].filter(address => {
            const key = address.toLowerCase();

            if (used.has(key)) {
                return false;
            }

            used.add(key);
            return true;
        });
    }

    return recipients;
}

/**
 * 更新前に保存した変更情報を読み取る。
 * 引き継ぎデータがない場合はnullを返す。
 */
function readNotificationChanges() {
    const notificationDataJson = context.UserData.notificationData;

    if (!notificationDataJson) {
        return null;
    }

    const notificationData = JSON.parse(notificationDataJson);
    const changedFields = notificationData.changedFields || {};

    context.Log(`changedFields: ${JSON.stringify(changedFields)}`);

    return changedFields;
}

/**
 * 変更された項目を起点に、有効な候補ルールを取得する。
 */
function getCandidateNotificationRules(changedFieldNames) {
    const relatedConditions = getRelatedConditions(changedFieldNames);
    const notificationRuleIds = [
        ...new Set(
            relatedConditions.map(condition =>
                String(condition.ClassA)
            )
        )
    ];

    if (notificationRuleIds.length === 0) {
        context.Log("通知候補: なし");
        return [];
    }

    const notificationRules = getNotificationRules(notificationRuleIds);

    context.Log(`通知候補: ${notificationRules.map(rule => rule.Title).join(", ") || "なし"}`);

    return notificationRules;
}

/**
 * ルールに紐づく条件を取得し、判定結果を記録する。
 */
function matchesNotificationRule(rule, changedFields) {
    const ruleName = String(rule.DescriptionA ?? "");
    context.Log(`----- 通知ID: ${rule.Title}${ruleName ? `（${ruleName}）` : ""} -----`);

    const conditions = getNotificationConditions(rule.ResultId);

    context.Log(`通知条件: ${conditions.length}件`);

    for (const condition of conditions) {
        context.Log(
            `パターン${condition.ClassB || "1"} / ${condition.ClassC} / ` +
            `${condition.ClassD} / 比較値: ${condition.DescriptionB}`
        );
    }

    const matched = evaluateConditions(conditions, changedFields);

    context.Log(`条件成立: ${matched}`);

    return matched;
}

/**
 * 通知対象のグループから、組織ごとの送信先を解決する。
 */
function getTargetRecipientAddresses(rule, tenshoCode, target) {
    const groupCode = target.group;
    const addressType = target.addressType;

    if (!["To", "Cc", "Bcc"].includes(addressType)) {
        throw new Error(`宛先区分が不正です: ${addressType}`);
    }

    const organizationCodes = getOrganizationCodes(tenshoCode, groupCode);

    context.Log(
        `店所: ${tenshoCode} / グループ: ${groupCode} / ` +
        `組織: ${JSON.stringify(organizationCodes)}`
    );

    const addresses = [];

    for (const organizationCode of organizationCodes) {
        const mailRecipients = getMailRecipients(organizationCode);

        context.Log(
            `組織: ${organizationCode} / 宛先区分: ${addressType} / ` +
            `メール通知設定: ${mailRecipients.length}件`
        );

        addresses.push(...createRecipientAddresses(mailRecipients));
    }

    return addresses;
}

/**
 * To・Cc・Bccを作成し、重複排除とToの必須チェックを行う。
 */
function createNotificationRecipients(rule, tenshoCode, notificationTargets) {
    const recipients = {
        To: [],
        Cc: [],
        Bcc: []
    };

    for (const target of notificationTargets) {
        const addresses = getTargetRecipientAddresses(rule, tenshoCode, target);
        recipients[target.addressType].push(...addresses);
    }

    removeDuplicateRecipients(recipients);

    if (recipients.To.length === 0) {
        throw new Error("Toの通知先がありません");
    }

    return recipients;
}

/**
 * 件名・本文に含まれるプレースホルダーを置換する。
 */
function renderNotificationTemplate(template, templateValues) {
    return String(template ?? "").replace(
        /\{([^{}]+)\}/g,
        (match, key) => {
            if (!Object.prototype.hasOwnProperty.call(templateValues, key)) {
                throw new Error(`未定義の置換項目: ${key}`);
            }

            return templateValues[key];
        }
    );
}

/**
 * 更新後のレコードからメールの件名・本文を作成する。
 */
function createNotificationMessage(rule, tenshoCode) {
    const templateValues = {
        "件名": String(model.Title ?? ""),
        "店所コード": tenshoCode,
        "ステータス": String(model.ClassB ?? ""),
        "電圧": String(model.ClassF ?? "")
    };

    return {
        subject: renderNotificationTemplate(rule.DescriptionB, templateValues),
        body: renderNotificationTemplate(rule.DescriptionC, templateValues)
    };
}

/**
 * 送信内容を記録し、送信が有効な場合だけ通知APIを呼び出す。
 */
function sendNotification(rule, recipients, message) {
    context.Log(`To: ${recipients.To}`);
    context.Log(`Cc: ${recipients.Cc}`);
    context.Log(`Bcc: ${recipients.Bcc}`);
    context.Log(`件名: ${message.subject}`);
    context.Log(`本文: ${message.body}`);

    const SEND_ENABLED = false;

    if (!SEND_ENABLED) {
        return;
    }

    const notification = notifications.New();

    notification.Type = 1;
    notification.Address = recipients.To.join(",");
    notification.CcAddress = recipients.Cc.join(",");
    notification.BccAddress = recipients.Bcc.join(",");
    notification.Title = message.subject;
    notification.Body = message.body;

    if (notification.Send()) {
        context.Log(`リアルタイム通知の送信成功（通知ID: ${rule.Title}）`);
        context.AddMessage(`対象グループに通知メールを送信しました。（通知ID: ${rule.Title}）`, 'alert-information');
    } else {
        context.Log(`リアルタイム通知の送信失敗（通知ID: ${rule.Title}）`);
        context.AddMessage(`通知メールの送信に失敗しました。（通知ID: ${rule.Title}）`, 'alert-error');
    }
}

/**
 * 条件が成立したルールの通知対象を取得し、通知を処理する。
 */
function processNotificationRule(rule) {
    const notificationTargets = getNotificationTargets(rule.ResultId);

    if (notificationTargets.length === 0) {
        context.Log("通知対象が未設定のためスキップ");
        return;
    }

    context.Log(`通知対象: ${JSON.stringify(notificationTargets)}`);

    const tenshoCode = String(model.ClassD ?? "");
    const recipients = createNotificationRecipients(rule, tenshoCode, notificationTargets);
    const message = createNotificationMessage(rule, tenshoCode);

    sendNotification(rule, recipients, message);
}

/**
 * 変更情報を起点に候補ルールを判定し、成立した通知を処理する。
 */
function sendRealtimeNotification() {
    const changedFields = readNotificationChanges();

    if (!changedFields) {
        return;
    }

    const changedFieldNames = Object.keys(changedFields);

    if (changedFieldNames.length === 0) {
        return;
    }

    const notificationRules = getCandidateNotificationRules(changedFieldNames);

    for (const rule of notificationRules) {
        if (matchesNotificationRule(rule, changedFields)) {
            processNotificationRule(rule);
        }
    }

    context.Log("----- 通知処理終了 -----");
}
