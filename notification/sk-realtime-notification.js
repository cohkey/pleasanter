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

            context.Log(`oldValue: ${oldValue}, newValue: ${newValue}`);

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

    context.Log(`records.length: ${records.length}, records[0]: ${JSON.stringify(records[0])}`);

    // 通知の基点となる判定方法
    const triggerOperators = ["CHANGED", "TO"];

    return records.filter(record => {
        context.Log(`record.ClassD: ${record.ClassD}`);
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
                ClassA: String(ruleId)
            },
            ColumnFilterSearchTypes: {
                ClassA: "ExactMatch"
            }
        }
    };

    return Array.from(items.Get(
        843614,
        JSON.stringify(data)
    ));
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

        case "EQ":
            return newValue === value;

        case "NE":
            return newValue !== value;

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
                ClassA: String(ruleId)
            },
            ColumnFilterSearchTypes: {
                ClassA: "ExactMatch"
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

function getOrganizationCodes(tenshoCode, groupCode) {
    const data = {
        View: {
            ColumnFilterHash: {
                ClassA: tenshoCode,
                ClassC: groupCode
            },
            ColumnFilterSearchTypes: {
                ClassA: "ExactMatch",
                ClassC: "ExactMatch"
            }
        }
    };

    const records = Array.from(items.Get(
        SITE_IDS.organizations,
        JSON.stringify(data)
    ));

    return records
        .filter(record =>
            String(record.ClassA) === String(tenshoCode) &&
            String(record.ClassC) === String(groupCode)
        )
        .map(record => String(record.DescriptionA ?? ""))
        .filter(Boolean);
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
        context.Log(`メールアドレス: ${JSON.stringify(address)}`);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
            throw new Error("メールアドレスの形式が不正です。");
        }
    }

    return addresses;
}

function createRecipientAddresses(mailRecipients) {
    const addresses = [];

    for (const recipient of mailRecipients) {
        const userIds = parseNotificationUsers(recipient.notificationUsers);

        // context.Log(`解析前: ${JSON.stringify(recipient.notificationUsers)}`);
        // context.Log(`解析後: ${JSON.stringify(userIds)}`);

        // Pleasanterのユーザ宛先形式
        for (const userId of userIds) {
            addresses.push(`[User${userId}]`);
        }

        // 直接指定されたメールアドレス
        const mailAddresses = parseMailAddresses(recipient.emailAddresses);

        addresses.push(...mailAddresses);
    }

    // context.Log(`変換後: ${JSON.stringify(addresses)}`);
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

function sendRealtimeNotification() {
    const notificationDataJson = context.UserData.notificationData;

    if (!notificationDataJson) {
        return;
    }

    const notificationData = JSON.parse(notificationDataJson);

    const changedFields = notificationData.changedFields || {};
    const changedFieldNames = Object.keys(changedFields);

    context.Log(`changedFields: ${JSON.stringify(changedFields)}`);

    if (changedFieldNames.length === 0) {
        return;
    }

    // 変更項目に関連する通知条件を取得
    const relatedConditions = getRelatedConditions(changedFieldNames);

    // 候補となる通知ルールIDを抽出
    const notificationRuleIds = [
        ...new Set(
            relatedConditions.map(condition =>
                String(condition.ClassA)
            )
        )
    ];

    context.Log(`通知候補ルールID: ${JSON.stringify(notificationRuleIds)}`);

    if (notificationRuleIds.length === 0) {
        return;
    }

    // 有効な通知ルールを取得
    const notificationRules = getNotificationRules(notificationRuleIds);

    // 取得結果をログで確認
    for (const rule of notificationRules) {
        context.Log(`通知ID: ${rule.Title}, 通知名: ${rule.DescriptionA}`);
    }

    for (const rule of notificationRules) {
        const conditions = getNotificationConditions(rule.ResultId);

        context.Log(`通知条件の取得件数: ${conditions.length}`);

        for (const condition of conditions) {
            context.Log(
                `パターン: ${condition.ClassB}` +
                `項目: ${condition.ClassC}` +
                `判定方法: ${condition.ClassD}` +
                `比較値: ${condition.DescriptionB}`
            );
        }

        const matched = evaluateConditions(
            conditions,
            changedFields
        );

        context.Log(`通知ID: ${rule.Title}, 条件成立: ${matched}`);

        if (!matched) {
            continue;
        }

        // 通知対象グループを取得
        const notificationTargets = getNotificationTargets(rule.ResultId);

        // 取得結果をログに出力
        context.Log(
            `通知ID: ${rule.Title}, ` +
            `通知対象: ${JSON.stringify(notificationTargets)}`
        );

        if (notificationTargets.length === 0) {
            context.Log(`通知対象が未設定: ${rule.Title}`);
            continue;
        }

        const tenshoCode = String(model.ClassD ?? "");

        const recipients = {
            To: [],
            Cc: [],
            Bcc: []
        };

        for (const target of notificationTargets) {
            // 通知対象のグループ区分
            const groupCode = target.group;
            const addressType = target.addressType;

            if (!["To", "Cc", "Bcc"].includes(addressType)) {
                throw new Error(`宛先区分が不正です: ${addressType}`);
            }

            // 店所コードとグループ区分から組織コードを取得
            const organizationCodes = getOrganizationCodes(tenshoCode, groupCode);

            context.Log(
                `通知ID: ${rule.Title}, ` +
                `店所コード: ${tenshoCode}, ` +
                `グループ区分: ${groupCode} ` +
                `組織コード: ${JSON.stringify(organizationCodes)}`
            );

            for (const organizationCode of organizationCodes) {
                const mailRecipients = getMailRecipients(organizationCode);

                context.Log(
                    `通知ID: ${rule.Title}, ` +
                    `組織コード: ${organizationCodes}, ` +
                    `宛先区分: ${addressType}, ` +
                    `設定件数: ${mailRecipients.length}, ` +
                    `宛先: ${JSON.stringify(mailRecipients)}`
                );

                // ユーザID・メールアドレスを宛先に変換
                const addresses = createRecipientAddresses(mailRecipients);

                recipients[addressType].push(...addresses);

                // for (const recipient of mailRecipients) {
                //     context.Log(`通知先: ${recipient.notificationUsers}`);
                //     context.Log(`メールアドレス設定あり: ${recipient.emailAddresses.trim() !== ""}`);
                // }
            }
        }

        // 重複する宛先を除外
        removeDuplicateRecipients(recipients);

        if (recipients.To.length === 0) {
            throw new Error("Toの通知先がありません");
        }

        // メールテンプレートの置換地
        const templateValues = {
            "件名": String(model.Title ?? ""),
            "店所コード": tenshoCode,
            "ステータス": String(model.ClassB ?? ""),
            "電圧": String(model.ClassF ?? "")
        };

        // 件名・本文のプレースホルダーを置換
        const renderTemplate = template =>
            String(template ?? "").replace(
                /\{([^{}]+)\}/g,
                (match, key) => {
                    if (!Object.prototype.hasOwnProperty.call(
                        templateValues, key
                    )) {
                        throw new Error(
                            `未定義の置換項目: ${key}`
                        );
                    }
                    return templateValues[key];
                }
            );

        const subject = renderTemplate(rule.DescriptionB);
        const body = renderTemplate(rule.DescriptionC);

        // 送信直前の確認ログ
        context.Log(`通知ID: ${rule.Title}`);
        context.Log(`To: ${recipients.To}`);
        context.Log(`CC: ${recipients.Cc}`);
        context.Log(`Bcc: ${recipients.Bcc}`);
        context.Log(`件名: ${subject}`);
        context.Log(`本文: ${body}`);

        // メール送信
        const SEND_ENABLED = false;

        if (SEND_ENABLED) {
            const notification = notifications.New();

            notification.Type = 1;
            notification.Address = recipients.To.join(",");
            notification.CcAddress = recipients.Cc.join(",");
            notification.BccAddress = recipients.Bcc.join(",");
            notification.Title = subject;
            notification.Body = body;

            if(notification.Send()){
                context.Log(`リアルタイム通知の送信成功（通知ID: ${rule.Title}）`)
                context.AddMessage(`対象グループに通知メールを送信しました。（通知ID: ${rule.Title}）`, 'alert-information')
            }else{
                context.Log(`リアルタイム通知の送信失敗（通知ID: ${rule.Title}）`)
                context.AddMessage(`通知メールの送信に失敗しました。（通知ID: ${rule.Title}）`, 'alert-error')
            }
        }
    }
}
