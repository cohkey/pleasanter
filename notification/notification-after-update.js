
/**
 * NotificationAfterUpdate
 *
 * 実行条件：更新後
 *
 * 更新情報に基づいて通知ルールを判定し、
 * 組織に紐づく宛先へメール通知する。
 */

// ==================================================
// 1. 設定
// ==================================================

// 実際のサイトIDに変更すること
const SITE_IDS = {
    rules: 0,
    conditions: 0,
    targets: 0,
    organizations: 0,
    mailSettings: 0
};

// 論理項目名と物理項目名
const NOTIFICATION_FIELDS = {
    status: "ClassB",
    tenshoCode: "ClassD",
    denatsu: "ClassF"
};

// 送信を許可するか
const SEND_ENABLED = false;


// ==================================================
// 2. 共通処理
// ==================================================

/**
 * 指定したサイトから、完全一致でレコードを取得する。
 */
function getRecords(siteId, filters, searchTypes = {}) {
    if (!siteId) {
        throw new Error("サイトIDが設定されていません");
    }

    const columnFilterHash = {};

    for (const [column, value] of Object.entries(filters)) {
        columnFilterHash[column] = String(value);
    }

    const data = {
        View: {
            ColumnFilterHash: columnFilterHash,
            ColumnFilterSearchTypes: searchTypes
        }
    };

    return Array.from(
        items.Get(siteId, JSON.stringify(data))
    );
}

/**
 * 単一項目の完全一致検索。
 */
function getExactRecords(siteId, column, value) {
    return getRecords(
        siteId,
        { [column]: value },
        { [column]: "ExactMatch" }
    );
}

/**
 * 真偽値として有効か判定する。
 */
function isEnabled(value) {
    return value === true ||
        value === 1 ||
        String(value).toLowerCase() === "true";
}


// ==================================================
// 3. 通知ルール・通知条件
// ==================================================

/**
 * 変更された項目に関連する通知条件を取得する。
 *
 * CHANGED / TO をトリガーとして扱う。
 */
function getRelatedConditions(changedFieldNames) {
    if (changedFieldNames.length === 0) {
        return [];
    }

    const conditions = getRecords(
        SITE_IDS.conditions,
        {
            ClassC: JSON.stringify(changedFieldNames)
        },
        {
            ClassC: "ExactMatchMultiple"
        }
    );

    return conditions.filter(condition => {
        const fieldName = String(condition.ClassC ?? "");
        const operator = String(condition.ClassD ?? "");

        return changedFieldNames.includes(fieldName) &&
            ["CHANGED", "TO"].includes(operator);
    });
}

/**
 * 有効な通知ルールを取得する。
 */
function getNotificationRules(ruleIds) {
    const rules = [];

    for (const ruleId of ruleIds) {
        const records = Array.from(
            items.Get(Number(ruleId))
        );

        for (const rule of records) {
            if (isEnabled(rule.CheckA)) {
                rules.push(rule);
            }
        }
    }

    return rules;
}

/**
 * 指定ルールに紐づくすべての通知条件を取得する。
 */
function getNotificationConditions(ruleId) {
    const conditions = getExactRecords(
        SITE_IDS.conditions,
        "ClassA",
        ruleId
    );

    return conditions.filter(condition =>
        String(condition.ClassA) === String(ruleId)
    );
}

/**
 * 1件の通知条件を評価する。
 */
function evaluateCondition(condition, changedFields) {
    const fieldName = String(condition.ClassC ?? "");
    const operator = String(condition.ClassD ?? "");
    const compareValue = String(
        condition.DescriptionB ?? ""
    );

    const columnName = NOTIFICATION_FIELDS[fieldName];

    if (!columnName) {
        throw new Error(
            `未定義の通知項目: ${fieldName}`
        );
    }

    const currentValue = String(
        model[columnName] ?? ""
    );

    const change = changedFields[fieldName];
    const isChanged = change !== undefined;

    switch (operator) {
        case "CHANGED":
            return isChanged;

        case "TO":
            return isChanged &&
                currentValue === compareValue;

        case "EQ":
            return currentValue === compareValue;

        case "NE":
            return currentValue !== compareValue;

        case "GE":
        case "LE": {
            if (
                currentValue.trim() === "" ||
                compareValue.trim() === ""
            ) {
                return false;
            }

            const currentNumber = Number(currentValue);
            const compareNumber = Number(compareValue);

            if (
                !Number.isFinite(currentNumber) ||
                !Number.isFinite(compareNumber)
            ) {
                return false;
            }

            return operator === "GE"
                ? currentNumber >= compareNumber
                : currentNumber <= compareNumber;
        }

        default:
            throw new Error(
                `未定義の比較演算子: ${operator}`
            );
    }
}

/**
 * 通知条件を条件パターンごとに評価する。
 *
 * 同一パターン：AND
 * 異なるパターン：OR
 * パターン内にはCHANGEDまたはTOが必要。
 */
function evaluateConditions(conditions, changedFields) {
    if (conditions.length === 0) {
        return false;
    }

    const patterns = {};

    for (const condition of conditions) {
        const pattern = String(condition.ClassB ?? "");

        if (!patterns[pattern]) {
            patterns[pattern] = [];
        }

        patterns[pattern].push(condition);
    }

    return Object.values(patterns).some(patternConditions => {
        const hasTrigger = patternConditions.some(condition =>
            ["CHANGED", "TO"].includes(
                String(condition.ClassD ?? "")
            )
        );

        if (!hasTrigger) {
            return false;
        }

        return patternConditions.every(condition =>
            evaluateCondition(condition, changedFields)
        );
    });
}

/**
 * 変更された項目に関連し、
 * 通知条件が成立した有効ルールを取得する。
 */
function getMatchedRules(changedFields) {
    const fieldNames = Object.keys(changedFields);

    const relatedConditions = getRelatedConditions(
        fieldNames
    );

    if (relatedConditions.length === 0) {
        return [];
    }

    const ruleIds = [
        ...new Set(
            relatedConditions.map(condition =>
                String(condition.ClassA)
            )
        )
    ];

    const rules = getNotificationRules(ruleIds);
    const matchedRules = [];

    for (const rule of rules) {
        const conditions = getNotificationConditions(
            rule.ResultId
        );

        if (evaluateConditions(conditions, changedFields)) {
            matchedRules.push(rule);
        }
    }

    return matchedRules;
}


// ==================================================
// 4. 通知対象・組織・メール通知設定
// ==================================================

/**
 * 通知ルールに紐づく通知対象を取得する。
 */
function getNotificationTargets(ruleId) {
    const records = getExactRecords(
        SITE_IDS.targets,
        "ClassA",
        ruleId
    );

    return records
        .filter(record =>
            String(record.ClassA) === String(ruleId)
        )
        .map(record => ({
            group: String(record.ClassB ?? ""),
            addressType: String(record.ClassC ?? "")
        }));
}

/**
 * 店所コード・グループ区分に紐づく
 * 組織コードを取得する。
 */
function getOrganizationCodes(tenshoCode, groupCode) {
    const records = getRecords(
        SITE_IDS.organizations,
        {
            ClassA: tenshoCode,
            ClassC: groupCode
        },
        {
            ClassA: "ExactMatch",
            ClassC: "ExactMatch"
        }
    );

    return [
        ...new Set(
            records
                .filter(record =>
                    String(record.ClassA) === String(tenshoCode) &&
                    String(record.ClassC) === String(groupCode)
                )
                .map(record =>
                    String(record.DescriptionA ?? "").trim()
                )
                .filter(Boolean)
        )
    ];
}

/**
 * 組織コードに紐づくメール通知設定を取得する。
 *
 * ClassZ       : 通知先ユーザ（複数選択）
 * DescriptionA : メールアドレス
 * DescriptionB : 組織コード
 */
function getMailRecipients(organizationCode) {
    const records = getExactRecords(
        SITE_IDS.mailSettings,
        "DescriptionB",
        organizationCode
    );

    return records
        .filter(record =>
            String(record.DescriptionB) ===
            String(organizationCode)
        )
        .map(record => ({
            organizationCode: String(
                record.DescriptionB ?? ""
            ),
            notificationUsers: String(
                record.ClassZ ?? ""
            ),
            emailAddresses: String(
                record.DescriptionA ?? ""
            )
        }));
}


// ==================================================
// 5. 宛先の変換・重複排除
// ==================================================

/**
 * ClassZのJSON配列文字列をユーザID配列に変換。
 *
 * 入力例：["38891","12345"]
 */
function parseNotificationUsers(value) {
    if (!value) {
        return [];
    }

    const userIds = JSON.parse(String(value));

    if (!Array.isArray(userIds)) {
        throw new Error(
            "通知先ユーザの形式が不正です"
        );
    }

    return userIds.map(id => {
        const userId = String(id).trim();

        if (!/^[0-9]+$/.test(userId)) {
            throw new Error(
                `通知先ユーザIDが不正です: ${userId}`
            );
        }

        return userId;
    });
}

/**
 * メールアドレス文字列を配列に変換する。
 *
 * カンマ・セミコロン・改行区切りに対応。
 */
function parseMailAddresses(value) {
    const text = String(value ?? "").trim();

    if (!text) {
        return [];
    }

    const addresses = text
        .split(/[,;\r\n]+/)
        .map(address => address.trim())
        .filter(Boolean);

    for (const address of addresses) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
            throw new Error(
                "メールアドレスの形式が不正です"
            );
        }
    }

    return addresses;
}

/**
 * メール通知設定から送信用宛先配列を生成する。
 */
function createRecipientAddresses(mailRecipients) {
    const addresses = [];

    for (const recipient of mailRecipients) {
        const userIds = parseNotificationUsers(
            recipient.notificationUsers
        );

        for (const userId of userIds) {
            addresses.push(`[User${userId}]`);
        }

        const mailAddresses = parseMailAddresses(
            recipient.emailAddresses
        );

        addresses.push(...mailAddresses);
    }

    return addresses;
}

/**
 * To > Cc > Bcc の優先順位で
 * 文字列が一致する宛先の重複を取り除く。
 */
function removeDuplicateRecipients(recipients) {
    const seen = new Set();

    for (const addressType of ["To", "Cc", "Bcc"]) {
        recipients[addressType] = recipients[addressType]
            .filter(address => {
                const key = address.toLowerCase();

                if (seen.has(key)) {
                    return false;
                }

                seen.add(key);
                return true;
            });
    }
}

/**
 * 店所コードとグループ区分から
 * 送信用宛先を取得する。
 */
function getGroupAddresses(tenshoCode, groupCode) {
    const organizationCodes = getOrganizationCodes(
        tenshoCode,
        groupCode
    );

    const addresses = [];

    for (const organizationCode of organizationCodes) {
        const mailRecipients = getMailRecipients(
            organizationCode
        );

        addresses.push(
            ...createRecipientAddresses(mailRecipients)
        );
    }

    return addresses;
}

/**
 * 通知ルールからTo・Cc・Bccを生成する。
 */
function getNotificationAddresses(ruleId, tenshoCode) {
    const targets = getNotificationTargets(ruleId);

    if (targets.length === 0) {
        throw new Error(
            "通知対象が未設定です"
        );
    }

    const recipients = {
        To: [],
        Cc: [],
        Bcc: []
    };

    for (const target of targets) {
        const { group, addressType } = target;

        if (!Object.prototype.hasOwnProperty.call(
            recipients,
            addressType
        )) {
            throw new Error(
                `宛先区分が不正です: ${addressType}`
            );
        }

        const addresses = getGroupAddresses(
            tenshoCode,
            group
        );

        recipients[addressType].push(...addresses);
    }

    removeDuplicateRecipients(recipients);

    if (recipients.To.length === 0) {
        throw new Error(
            "Toの通知先がありません"
        );
    }

    return recipients;
}


// ==================================================
// 6. メールテンプレート
// ==================================================

/**
 * テンプレートの{項目名}を置換する。
 */
function renderNotificationTemplate(template, values) {
    return String(template ?? "").replace(
        /\{([^{}]+)\}/g,
        (match, key) => {
            if (!Object.prototype.hasOwnProperty.call(
                values,
                key
            )) {
                throw new Error(
                    `未定義の置換項目: ${key}`
                );
            }

            return values[key];
        }
    );
}

/**
 * 通知ルールの件名・本文を生成する。
 */
function createNotificationMessage(rule, tenshoCode) {
    const values = {
        "件名": String(model.Title ?? ""),
        "店所コード": tenshoCode,
        "ステータス": String(model.ClassB ?? ""),
        "電圧": String(model.ClassF ?? "")
    };

    return {
        subject: renderNotificationTemplate(
            rule.DescriptionB,
            values
        ),
        body: renderNotificationTemplate(
            rule.DescriptionC,
            values
        )
    };
}


// ==================================================
// 7. メール送信
// ==================================================

/**
 * Pleasanterの通知APIでメールを送信する。
 */
function sendNotification(recipients, message) {
    if (!SEND_ENABLED) {
        context.Log(
            `送信無効: ${message.subject}`
        );

        return false;
    }

    const notification = notifications.New();

    notification.Type = 1;
    notification.Address = recipients.To.join(",");
    notification.CcAddress = recipients.Cc.join(",");
    notification.BccAddress = recipients.Bcc.join(",");
    notification.Title = message.subject;
    notification.Body = message.body;

    return notification.Send();
}


// ==================================================
// 8. メイン処理
// ==================================================

/**
 * リアルタイムメール通知を実行する。
 */
function sendRealtimeNotification() {
    const notificationJson =
        context.UserData.notificationData;

    if (!notificationJson) {
        return;
    }

    const notificationData = JSON.parse(
        notificationJson
    );

    const changedFields =
        notificationData.changedFields || {};

    if (Object.keys(changedFields).length === 0) {
        return;
    }

    const rules = getMatchedRules(changedFields);
    const tenshoCode = String(model.ClassD ?? "");

    for (const rule of rules) {
        try {
            const recipients = getNotificationAddresses(
                rule.ResultId,
                tenshoCode
            );

            const message = createNotificationMessage(
                rule,
                tenshoCode
            );

            const result = sendNotification(
                recipients,
                message
            );

            context.Log(
                `通知処理結果: ${rule.Title} / ${result}`
            );
        } catch (error) {
            context.Log(
                `通知処理エラー: ${rule.Title} / ${error.message}`
            );
        }
    }
}


// ==================================================
// 9. 実行
// ==================================================

sendRealtimeNotification();
