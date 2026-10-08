import Link from "next/link"

import base from "@/registry/factory/base/registry.json"
import hooks from "@/registry/factory/hooks/registry.json"
import lib from "@/registry/factory/lib/registry.json"
import themes from "@/registry/factory/themes/registry.json"
import ui from "@/registry/factory/ui/registry.json"

// 층·항목 목록은 registry.json(npm run registry:gen 산출물)에서 읽는다 — 손으로 적은 목록이 어긋나지 않게.
const LAYERS = [
  { name: "ui", items: ui.items },
  { name: "lib", items: lib.items },
  { name: "hooks", items: hooks.items },
  { name: "themes", items: themes.items },
  { name: "base", items: base.items },
]

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-3xl font-semibold">web-factory 부품 창고</h1>
      <p className="mt-3 text-muted-foreground">
        층별 항목 목록입니다. 부품을 실제로 눌러 보려면{" "}
        <Link href="/qa/base" className="text-foreground underline underline-offset-4">
          기본 부품 검수대
        </Link>
        로 가세요.
      </p>
      {LAYERS.map((layer) => (
        <section key={layer.name} className="mt-10">
          <h2 className="font-heading text-xl font-medium">
            {layer.name} <span className="text-muted-foreground tabular-nums">{layer.items.length}개</span>
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {layer.items.map((item) => (
              <li key={item.name}>
                {layer.name === "ui" ? (
                  <Link
                    href={`/qa/base#c-${item.name}`}
                    className="inline-flex min-h-11 items-center rounded-md border px-3 underline-offset-4 hover:underline"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <span className="inline-flex min-h-11 items-center rounded-md border px-3">{item.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
