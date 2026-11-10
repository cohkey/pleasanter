/**
 * 変更履歴
 * 2026/11/10
 * ・固定組織の許可4コードを登録し、店所連動の宛先名に「店所に紐づく」を付加
 * ・TEST／PRODUCTION送信モードと通知対象の表示名を使う受付・送信結果メッセージを追加
 * 2026/11/09
 * ・通知対象区分を追加し、店所連動GMと固定組織の宛先解決に対応
 * ・成立したルールの詳細だけを通常出力し、デバッグフラグ・終了件数・常時エラー出力を追加
 * 2026/11/06
 * ・お客さまサービスグループ指定時に同店所の第一・第二・第三グループも検索し、組織コードを重複排除
 * ・通知対象・組織検索の分類フィルタを配列形式に修正し、組織未取得時の件数を記録
 * ・通知ログの空行と区切り線前の余分な改行を削除
 * ・通知IDごとの区切りと条件一覧を整え、重複するデバッグログを削除
 * 2026/11/05
 * ・複数値を文字列比較するIN・NOT_IN演算子と比較値の設定検証を追加
 * ・通知条件を親ルールIDで絞り込み、別通知IDの条件が混在する問題を修正
 */

const SITE_IDS = {
    conditions: 843614,
    rules: 843610,
    targets: 843620,
    organizations: 846822,
    gmMappings: 727689,
    mailSettings: 809267
}

// 通知対象ClassDの保存値。ClassBは区分に応じてグループ区分／組織コードを共用する。
const NOTIFICATION_TARGET_TYPES = ["ORGANIZATION", "GM", "FIXED_ORGANIZATION"];
const GM_MAPPING_FIELDS = {
    store: "ClassA",
    category: "ClassC",
    groupId: "NumA",
    groupCode: "DescriptionA",
    groupName: "ClassD"
};
// キーは通知対象ClassB、値はGM対応表ClassCの保存値。
const NOTIFICATION_GM_CATEGORIES = {
    "グリサGM": "グリサ",
    "客サGM": "客サ"
};
// 固定組織として指定できる組織コード（保存値）。
const FIXED_ORGANIZATION_CODES = ["1014797", "1015247", "1015246", "TTA"];

// 送信モードの参照はgetNotificationSendModeに集約する。初期値では実送信しない。
const NOTIFICATION_SEND_MODE = "TEST";

function getNotificationSendMode() {
    const mode = NOTIFICATION_SEND_MODE;
    if (!["TEST", "PRODUCTION"].includes(mode)) {
        throw new Error(`通知送信モードが不正です: ${mode}`);
    }
    return mode;
}

// trueにすると、不成立ルールも含む条件一覧・評価JSONを出力する。
const NOTIFICATION_DEBUG = false;
let notificationConditionLogBuffer = null;

function logNotificationDebug(message) {
    if (NOTIFICATION_DEBUG) {
        context.Log(message);
    }
}

function logNotificationCondition(message) {
    if (notificationConditionLogBuffer !== null) {
        notificationConditionLogBuffer.push(message);
    } else {
        logNotificationDebug(message);
    }
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

    logNotificationCondition(JSON.stringify({
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
            addressType: String(record.ClassC ?? ""),
            targetType: String(record.ClassD ?? "")
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

/**
 * 同じ店所・GM区分の全対応を取得する。客サの第一〜第三も区分「客サ」で登録する。
 */
function getGmGroupAddresses(tenshoCode, category) {
    const store = String(tenshoCode ?? "");
    if (!store) {
        throw new Error("GM検索の店所コードが未設定です");
    }

    const fields = GM_MAPPING_FIELDS;
    const data = {
        View: {
            ColumnFilterHash: {
                [fields.store]: JSON.stringify([store]),
                [fields.category]: JSON.stringify([category])
            },
            ColumnFilterSearchTypes: {
                [fields.store]: "ExactMatchMultiple",
                [fields.category]: "ExactMatchMultiple"
            }
        }
    };
    const records = Array.from(items.Get(SITE_IDS.gmMappings, JSON.stringify(data)));
    const matched = records.filter(record =>
        String(record[fields.store]) === store &&
        String(record[fields.category]) === category
    );
    if (matched.length === 0) {
        throw new Error(`GM対応がありません（店所: ${store} / 区分: ${category}）`);
    }

    const addresses = matched.map(record => {
        const rawId = record[fields.groupId];
        const groupId = Number(rawId);
        // GroupIdはPleasanterの正のInt32。NumAの小数・負数・空値を宛先へ流さない。
        if (!["string", "number"].includes(typeof rawId) ||
            !/^\d+(?:\.0+)?$/.test(String(rawId).trim()) || !Number.isInteger(groupId) ||
            groupId <= 0 || groupId > 2147483647) {
            throw new Error(`GMグループIDが不正です: ${rawId}`);
        }
        const groupCode = String(record[fields.groupCode] ?? "");
        if (!/^GM[^\s,;\[\]]+$/.test(groupCode)) {
            throw new Error(`GMグループコードが不正です: ${groupCode}`);
        }
        logNotificationDebug(
            `GM: ${record[fields.groupName] ?? ""} / コード: ${groupCode} / GroupId: ${groupId}`
        );
        return `[Group${groupId}]`;
    });
    return [...new Set(addresses)];
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

    logNotificationDebug(`changedFields: ${JSON.stringify(changedFields)}`);

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
        logNotificationDebug("通知候補: なし");
        return [];
    }

    const notificationRules = getNotificationRules(notificationRuleIds);

    logNotificationDebug(`通知候補: ${notificationRules.map(rule => rule.Title).join(", ") || "なし"}`);

    return notificationRules;
}

/**
 * ルールに紐づく条件を取得し、判定結果を記録する。
 */
function matchesNotificationRule(rule, changedFields) {
    const previousBuffer = notificationConditionLogBuffer;
    const messages = [];
    notificationConditionLogBuffer = messages;

    try {
        const ruleName = String(rule.DescriptionA ?? "");
        logNotificationCondition(`----- 通知ID: ${rule.Title}${ruleName ? `（${ruleName}）` : ""} -----`);

        const conditions = getNotificationConditions(rule.ResultId);
        logNotificationCondition(`通知条件: ${conditions.length}件`);

        for (const condition of conditions) {
            logNotificationCondition(
                `パターン${condition.ClassB || "1"} / ${condition.ClassC} / ` +
                `${condition.ClassD} / 比較値: ${condition.DescriptionB}`
            );
        }

        const matched = evaluateConditions(conditions, changedFields);
        logNotificationCondition(`条件成立: ${matched}`);

        if (matched || NOTIFICATION_DEBUG) {
            for (const message of messages) {
                context.Log(message);
            }
        }

        return matched;
    } catch (error) {
        // 判定中のエラーは、不成立の詳細非表示とは区別して常に状況を残す。
        for (const message of messages) {
            context.Log(message);
        }
        throw error;
    } finally {
        notificationConditionLogBuffer = previousBuffer;
    }
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

    const targetType = target.targetType;
    if (!NOTIFICATION_TARGET_TYPES.includes(targetType)) {
        throw new Error(`通知対象区分が不正です: ${targetType ?? ""}`);
    }
    if (!groupCode) {
        throw new Error("通知対象グループが未設定です");
    }

    const isGm = Object.prototype.hasOwnProperty.call(NOTIFICATION_GM_CATEGORIES, groupCode);
    const isFixed = FIXED_ORGANIZATION_CODES.includes(groupCode);
    if (targetType === "GM") {
        if (!isGm || isFixed) {
            throw new Error(`GMの対象グループが不正です: ${groupCode}`);
        }
        const addresses = getGmGroupAddresses(tenshoCode, NOTIFICATION_GM_CATEGORIES[groupCode]);
        context.Log(`店所: ${tenshoCode} / GM: ${groupCode} / 宛先: ${JSON.stringify(addresses)}`);
        return addresses;
    }

    let organizationCodes;
    if (targetType === "FIXED_ORGANIZATION") {
        if (!isFixed || isGm) {
            throw new Error(`固定組織の許可コードにありません: ${groupCode}`);
        }
        organizationCodes = [groupCode];
        context.Log(`固定組織: ${groupCode} / 宛先区分: ${addressType}`);
    } else {
        if (isGm || isFixed) {
            throw new Error(`店所連動組織の対象グループが不正です: ${groupCode}`);
        }
        organizationCodes = getOrganizationCodes(tenshoCode, groupCode);
        context.Log(
            `店所: ${tenshoCode} / グループ: ${groupCode} / ` +
            `組織: ${JSON.stringify(organizationCodes)}`
        );
    }

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
 * 店所連動は指定の名称に接頭語を付け、固定組織はClassBの表示名を使う。
 * 取得不能時は保存コードを対象名と推測せず、対象全体を表す文言にする。
 */
function getNotificationTargetLabel(targets) {
    const uniqueTargets = [...new Map(targets.map(target =>
        [JSON.stringify([target.targetType, target.group]), target]
    )).values()];
    const fallback = uniqueTargets.length > 1
        ? `指定された通知対象（${uniqueTargets.length}件）`
        : "指定された通知対象";

    // 表示専用。宛先検索に使う保存値・グループ対応は変更しない。
    const storeLabels = {
        ORGANIZATION: {
            "客サ": "お客さまサービスG",
            "お客さまサービスグループ": "お客さまサービスG",
            "お客さまサービスG": "お客さまサービスG",
            "グリサ": "グリッドサービスG",
            "グリッドサービスG": "グリッドサービスG"
        },
        GM: {
            "客サGM": "お客さまサービスGM",
            "グリサGM": "グリッドサービスGM"
        }
    };
    const knownName = target => {
        const names = storeLabels[target.targetType];
        return names && Object.prototype.hasOwnProperty.call(names, target.group)
            ? names[target.group] : undefined;
    };
    let names = uniqueTargets.map(knownName);
    if (names.some(name => !name)) {
        try {
            const site = Array.from(items.GetSite(SITE_IDS.targets))[0];
            const column = Array.from(site?.SiteSettings?.Columns || [])
                .find(column => column.ColumnName === "ClassB");
            const labels = new Map();
            // Pleasanter 1.4.23.3既定の選択肢形式：保存値,表示名,略称,...（\,はカンマ）。
            for (const line of String(column?.ChoicesText ?? "").split(/\r\n|\n|\r/)) {
                if (!line || line.startsWith("[")) continue;
                const parts = line.split(/(?<!\\),/).map(value => value.replace(/\\,/g, ","));
                if (!labels.has(parts[0])) labels.set(parts[0], parts[1] || parts[0]);
            }
            names = uniqueTargets.map(target => knownName(target) || labels.get(target.group));
        } catch (error) {
            context.Log(`通知対象の表示名を取得できません: ${error.message}`);
            return fallback;
        }
    }
    if (names.length === 0 || names.some(name => !name)) {
        context.Log("通知対象の表示名を取得できないため、対象名を省略して表示します");
        return fallback;
    }
    return [...new Set(names.map((name, index) =>
        uniqueTargets[index].targetType === "FIXED_ORGANIZATION" || name.startsWith("店所に紐づく")
            ? name : `店所に紐づく${name}`
    ))].join("、");
}

/**
 * TESTは受付表示のみ、PRODUCTIONは既存の通知APIで送信する。
 */
function sendNotification(rule, recipients, message, targets, mode = getNotificationSendMode()) {
    context.Log(`To: ${recipients.To}`);
    context.Log(`Cc: ${recipients.Cc}`);
    context.Log(`Bcc: ${recipients.Bcc}`);
    context.Log(`件名: ${message.subject}`);
    context.Log(`本文: ${message.body}`);

    // 呼出側の引数が不正でもPRODUCTION扱いにしない。
    if (!["TEST", "PRODUCTION"].includes(mode)) {
        throw new Error(`通知送信モードが不正です: ${mode}`);
    }
    const targetLabel = getNotificationTargetLabel(targets);
    if (mode === "TEST") {
        context.Log("TESTモードのため実際のメールは送信していません");
        // 改行の実画面確認ができていないため、追加CSS不要の1行表示にする。
        context.AddMessage(
            `【テスト】${targetLabel}宛の依頼メールの送信を受け付けました。 ※実際のメールは送信していません。`,
            'alert-information'
        );
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
        context.AddMessage(`${targetLabel}宛に依頼メールを送信しました。`, 'alert-information');
    } else {
        context.Log(`リアルタイム通知の送信失敗（通知ID: ${rule.Title}）`);
        context.AddMessage(`${targetLabel}宛の依頼メールの送信に失敗しました。`, 'alert-error');
    }
}

/**
 * 条件が成立したルールの通知対象を取得し、通知を処理する。
 */
function processNotificationRule(rule, mode) {
    const notificationTargets = getNotificationTargets(rule.ResultId);

    if (notificationTargets.length === 0) {
        context.Log("通知対象が未設定のためスキップ");
        return;
    }

    context.Log(`通知対象: ${JSON.stringify(notificationTargets)}`);

    const tenshoCode = String(model.ClassD ?? "");
    const recipients = createNotificationRecipients(rule, tenshoCode, notificationTargets);
    const message = createNotificationMessage(rule, tenshoCode);

    sendNotification(rule, recipients, message, notificationTargets, mode);
}

/**
 * 変更情報を起点に候補ルールを判定し、成立した通知を処理する。
 */
function sendRealtimeNotification() {
    let candidateCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    let interrupted = false;

    try {
        const mode = getNotificationSendMode();
        const changedFields = readNotificationChanges();

        if (!changedFields) {
            return;
        }

        const changedFieldNames = Object.keys(changedFields);

        if (changedFieldNames.length === 0) {
            return;
        }

        const notificationRules = getCandidateNotificationRules(changedFieldNames);
        candidateCount = notificationRules.length;

        for (const rule of notificationRules) {
            if (matchesNotificationRule(rule, changedFields)) {
                matchedCount++;
                processNotificationRule(rule, mode);
            } else {
                unmatchedCount++;
            }
        }
    } catch (error) {
        interrupted = true;
        context.Log(`通知処理エラー: ${error.message}`);
        throw error;
    } finally {
        const pending = interrupted ? ` / 未完了${candidateCount - matchedCount - unmatchedCount}件` : "";
        context.Log(
            `----- 通知処理${interrupted ? "中断" : "終了"}: ` +
            `候補${candidateCount}件 / 成立${matchedCount}件 / 不成立${unmatchedCount}件${pending} -----`
        );
    }
}
