# Figma'dan olingan aniq qiymatlar (Feeder detail, node 4029:930)

> Figma MCP kvotasi tugagani uchun maket **mahalliy nusxadan** o'qiladi.
> Bu yerdagi qiymatlar `get_design_context` chiqishidan aynan ko'chirilgan.

## Mahalliy manbalar

| Fayl | Nima |
|---|---|
| `.claude/figma/feeder/00-full.png` | butun sahifa, 1920x1080, 1:1 |
| `.claude/figma/feeder/<karta>.png` | kartaning kattalashtirilgan kesimi (3-4x) |
| `.claude/figma/feeder/<karta>.xml` | o'sha kartaning Figma tugunlari: nom, x/y, w/h |
| `.claude/figma/map/structure.xml` | xarita sahifasining to'liq tuzilmasi |
| `.claude/figma/sample.ps1` | skrinshotdan piksel rangini olish |

Rasmni **Read** bilan oching - u ko'rinadi. XML dagi `x/y/width/height` -
ota tugunga nisbatan piksel; ular padding va gap'ni aniq beradi.

Rang olish (koordinatalar 1920x1080 kadr bo'yicha):

```
powershell -File .claude/figma/sample.ps1 -Points "436,20 460,42 1500,290"
```

## Umumiy uslub

- Karta: `bg-white`, `rounded-[12px]`, `p-[16px]`.
- Sahifa foni: `#f3f3f3`. Ustunlararo va qatorlararo bo'shliq: `8px`.
- Sarlavha (`Header`): balandligi `32px`, `flex items-center justify-between`.
  Matn: `Geist Bold 14px`, rang `#333`.
- Karta ichidagi bo'lim izohi: `12px`, rang `#767676`.
- Markazdagi pastki havola ("Ba'tafsil"): `14px medium`, rang `#007cd2`.

### Sarlavhadagi tugmalar (node 4029:1222)

```
Toggle btn:  bg-[#f3f3f3] rounded-[999px] p-[2px] gap-[2px]
  tugma:     size-[28px] rounded-full ; faol: bg-[#007cd2] + oq ikonka
  ikonka:    18px, stroke 1.5 (absolyut) -> <Icon size={18}/>
Yolg'iz tugma: bg-[#f3f3f3] rounded-[999px] p-[2px] + bitta 28px tugma
```

`SegmentedIcons` va `IconPill` (`@/components/ui/Toggle`) shuni aynan beradi.

### Jadval (node 4051:153)

```
sarlavha qatori: bg-[#007cd2] px-[6px] py-[8px] rounded-t-[6px]
                 border-b border-[#f0f0f0]
                 matn: 11px semibold, oq, markazda
qator:           p-[6px] border-b border-[#f0f0f0]
                 matn: 12px, #333, markazda; 1-ustun `font-medium`
oxirgi qator:    bg-[#f3f3f3] px-[6px] py-[8px] rounded-b-[6px], border yo'q
nishon (Badge):  rounded-full px-[8px] py-[2px] 10px semibold
                 Faol    bg-[#effff0] text-[#22c55e]
                 Nofaol  bg-[#ffefef] text-[#cf4646]
                 Ta'mirda bg-[#fff5ef] text-[#f59e0b]
```

`DataTable` va `Badge` (`@/components/ui/DataTable`) shuni beradi.

### KPI kartasi (node 4029:986, balandligi 196)

```
bg: tint (#eff6ff / #effff0 / #ffefef / #feefff / #f3efff / #fff5ef), p-[16px], rounded-[12px]
header  h-[32] items-start justify-between
        sarlavha 14px medium #333
        nishon   size-[32px] rounded-[6px] bg-<accent>, ichida 20px oq ikonka
qiymat  pt-[4px] pb-[6px] gap-[4px]  ->  24px bold #333  +  14px medium #555
delta   pb-[6px] gap-[4px]  ->  20px ikonka + 14px medium (#cf4646 yoki yashil)
o'tgan  pb-[8px]  ->  14px regular #555
chart   flex-1 gap-[8px] items-end
        ustunlar: grid, gap-x-[2px], har biri rounded-[1px] bg-<accent>
        yorliq:   14px regular #555 ("30 kun" / "12 oy")
```

Accent ranglar: `#3b82f6` `#22c55e` `#ff383c` `#cb30e0` `#6155f5` `#ac7f5e`.

### Xarita markeri (node 3947:372)

```
yorliq:  bg-[rgba(15,15,20,0.88)] rounded-[8px] px-[10px] py-[6px]
         matn 11px medium oq
strelka: 12x6 uchburchak, xuddi shu rang
igna:    27x41 -> public/map/pin.svg (Figma eksporti, ko'k #3B82F6)
```

`MapCanvas` ning `pinMarker` funksiyasi shuni chizadi.

### Chap panel (node 4029:932)

```
IconRail:  w-[72px] bg-[#2c2c2c] rounded-[16px] p-[6px]
           element h-[56px] rounded-[8px], faol: bg-[#444445]
           ikonka 32px oq
Sidebar:   w-[340px] bg-white rounded-[16px] p-[16px]
           sarlavha 16px bold #333
           havola px-[20px] py-[12px] rounded-[12px] gap-[16px]
                  ikonka 24px, matn 16px semibold #333
                  faol: bg-[#007cd2] + oq matn
promo:     rounded-[12px] p-[16px] gap-[16px], fon rasm /brand/ai-promo.png
           matn 16px semibold oq
           tugma h-[36px] rounded-[8px] bg-white,
                 20px sparkles (#0b1f5b) + 14px medium gradient (#007cd2 -> #44006c)
```

Bularning hammasi `src/components/shell/` da tayyor.

## Ikonka chizig'i

Maketda **hamma ikonka 1.5px absolyut** chiziqda. Lucide viewBox'i 24 birlik,
demak `strokeWidth = 36 / size`. Qo'lda yozmang - `<Icon icon={X} size={20} />`.
