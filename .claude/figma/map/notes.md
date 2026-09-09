# Xarita sahifasi - vizual izohlar

Maket: Figma node `3947:166`. Tuzilma `structure.xml` da (aniq x/y/w/h bilan).
Bu yerda faqat rasmda ko'rinadigan, XML da bo'lmagan narsalar.

## Umumiy joylashuv

```
[ rail 72 ] 8 [ Joylashuvlar 340 ] 8 [ Xarita 1128 ] 8 [ Ma'lumotlar 340 ]
```

Sahifa `p-8px`, foni `#f3f3f3`. Uchala panel `rounded-[16px]`.
Ikonka panelida faol element - **map** (3-chi), `bg-[#444445]`.

## Chap panel - "Joylashuvlar"

Sarlavha `Joylashuvlar` (16px bold #333), keyin 8px oraliqli qatorlar
(har biri 48px balandlikda, `rounded-[12px]`, `px-[20px]`):

1. **Ortga** qatori - chapda `chevron-left` (24px), keyin ota tugun nomi
   ("Podstansiya A404-SKJ"). Foni oq/shaffof, matn `#333` 16px semibold.
2. **Joriy tugun** - `bg-[#007cd2]`, oq matn, chapda daraja ikonkasi
   (fider -> `workflow`, TP -> `circuit-board`), o'ngda `chevron-down`
   (ochilgan holat). XML da `chevron-right` deyilgan, lekin rasmda pastga
   qaragan - ro'yxat ochiq.
3. **Bolalar ro'yxati** - har biri chapda `circuit-board` (24px, `#333`),
   nom 16px semibold, o'ngda `chevron-right` (24px, kulrang).
   Hover: `bg-[#f3f3f3]`.

Ro'yxat uzun bo'lsa vertikal skroll (`scrollbar-none`).

## Markaziy xarita

Google Maps, ochiq "roadmap" uslubi (`MapCanvas` dagi `MAP_STYLE` aynan shu).
Markerlar - ko'k igna + tepasida qora yorliq ("TP A303"), `pinMarker`.
Xarita to'liq to'rtburchakni egallaydi, `rounded-[16px]`, ichki elementlar yo'q
(zoom tugmalari o'chirilgan).

## O'ng panel - "Ma'lumotlar"

Oq karta, `p-[16px]`, bloklar orasi 8-10px. Yuqoridan pastga:

1. Sarlavha qatori: `Ma'lumotlar` (16px bold) + o'ngda `expand` (20px, `#333`).
2. Katta rasm 308x204, `rounded-[12px]`, `object-cover`.
3. 4 ta eskiz 80x80, `rounded-[8px]`, oraliq 10px. Tanlangani (birinchisi)
   `#007cd2` halqa bilan ajratilgan.
4. Tugun nomi: `A374 - 3B Podstansiyasi`, 16px bold `#333`.
5. 2x2 statistika: har biri ustidan izoh (12px `#767676`), ostida
   `bg-[#f3f3f3] rounded-[12px]` quti (balandligi ~45-48px, `px-[20px]`),
   ichida 20-24px ikonka + qiymat (16px semibold `#333`).
   Fiderlar / Transformatorlar / Abonentlar / Qoidabuzarliklar.
6. `Hisobot`: izoh, ostida `bg-[#f3f3f3] rounded-[12px]` quti. Chapda 80x80
   donut (halqa qalin, ichi bo'sh), o'ngda 3 qator: 16px dumaloq rang nuqtasi +
   izoh (12px `#767676`) ustida qiymat (16px semibold `#333`).
   Ranglar: Hisoblangan ko'k `#007cd2`, Iste'mol yashil `#22c55e`,
   Yo'qotish qizil `#ff383c`.
7. `Ma'sul shaxs`: izoh + `bg-[#f3f3f3]` qator, `user-shield` ikonka + ism.
8. `Sarfi yuqori transformatorlar`: izoh + 3 ta `bg-[#f3f3f3]` qator.
   Chapda `circuit-board` (20px) + TP nomi (16px semibold `#333`),
   o'ngda sarf qiymati **qizil** (`#cf4646`, 16px semibold), o'ngga tekislangan.

Panel to'liq sig'masa vertikal skroll (`scrollbar-none`).
