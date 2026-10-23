// Cihazlar menüsünden cihaz seçer; cihaz kapalı bir marka grubundaysa
// (Aşama 6 revizyonu, v0.6.4) önce grubu açar
export async function pickDevice(page, id) {
    const button = page
        .locator(`#device-list .device-button[data-device-id="${id}"]`)
        .first();
    if (!(await button.isVisible())) {
        await page
            .locator("#device-list .brand-group", {
                has: page.locator(`[data-device-id="${id}"]`),
            })
            .locator(".group-toggle")
            .click();
    }
    await button.click();
}
