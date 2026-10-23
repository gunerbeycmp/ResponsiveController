// Cihazlar menüsünden cihaz seçer; cihaz yalnızca kapalı gruplardaysa
// (Aşama 6 revizyonu, v0.6.4 - v0.6.5) önce birini açar
export async function pickDevice(page, id) {
    const buttons = page.locator(
        `#device-list .device-button[data-device-id="${id}"]`,
    );
    const visible = buttons.filter({ visible: true });
    if ((await visible.count()) === 0) {
        await page
            .locator("#device-list .collapsible-group", {
                has: page.locator(`[data-device-id="${id}"]`),
            })
            .first()
            .locator(".group-toggle")
            .click();
    }
    await visible.first().click();
}

// Görünen paneldeki bütün kapalı grupları açar (grupların kendisini
// denemeyen testler için)
export async function openAllGroups(page) {
    const closed = page.locator(
        '#device-list .group-toggle[aria-expanded="false"]',
    );
    while ((await closed.count()) > 0) await closed.first().click();
}
