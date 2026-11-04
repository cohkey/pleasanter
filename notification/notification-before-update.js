/**
 * NotificationBeforeUpdate
 *
 * 実行条件：更新前
 * 更新前後の項目値を比較し、変更情報を保存する。
 */

// 通知条件で使用する論理項目名と物理項目名
const NOTIFICATION_FIELDS = {
    status: "ClassB",
    tenshoCode: "ClassD",
    denatsu: "ClassF"
};

/**
 * 通知対象項目の変更情報を取得する。
 *
 * saved：更新前のレコード
 * model：更新後のレコード
 */
function getNotificationChanges() {
    const changedFields = {};

    for (const [fieldName, columnName] of
        Object.entries(NOTIFICATION_FIELDS)) {

        const oldValue = saved[columnName];
        const newValue = model[columnName];

        if (String(oldValue ?? "") !== String(newValue ?? "")) {
            changedFields[fieldName] = {
                oldValue: String(oldValue ?? ""),
                newValue: String(newValue ?? "")
            };
        }
    }

    return changedFields;
}

/**
 * 更新前の変更情報を更新後SSへ引き継ぐ。
 */
function saveNotificationChanges() {
    const changedFields = getNotificationChanges();

    context.UserData.notificationData = JSON.stringify({
        changedFields
    });
}

saveNotificationChanges();
