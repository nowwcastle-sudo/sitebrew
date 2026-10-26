# Notice lines and features that were not placed

Relay each case below by the `## Never` rules of the skill: none of these lines means the delivery failed.

## A line starting with `안내:`

The feature choice was **not applied** and the folder came out the default way for its type. The same sentence is in the README. Find the case:

- No feature record in the run folder: the user has not answered the feature questions for this run. Offer to ask them (the `new` skill, section 2 item 4), then deliver again into an empty folder.
- The feature table changed after the choice, or `features.json` could not be read: the old answers do not fit any more. Ask the feature questions again, write the choice again, and deliver again into an empty folder. The write command (`${CLAUDE_PLUGIN_ROOT}` is the plugin root; `--kit .` is the `sitebrew` folder):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . features-write --archetype <archetype> --input out/features.json --run <run folder>
```

- launch-factory was not found: the choice is on record but cannot be read. Deliver again with `--lf <launch-factory folder>` added to the delivery command; the same flag goes to `intake.mjs features` and `features-write`.

In these three cases do not call the site a product site, whatever the user chose: the folder came out the default way, until a new delivery has applied the choice. Keep provider and part names out of what you say.

## A line starting with `제품 이름·언어를 못 바꾼 자리`

This is not a `안내:` line, and the feature choice was applied. The product name or the share-preview language is not set everywhere. Tell the user to open the folder and check the name and the language.

## A README line with `넣지 않았어요`

For an intro site (not a product site) the README can list a chosen feature with the line 「…는 소개형 사이트에 넣을 곳이 없어서 넣지 않았어요」 or 「…는 이 시안에 문의 폼이나 신청 블록이 없어서 넣지 않았어요」. The tool does not print these lines. Relay each one in one plain sentence, with the feature's result word from the README:

- No place in an intro site: this feature only works in a product site. Offer to ask the feature questions again if the user wants a product site.
- No contact form or sign-up block: the inquiry feature needs a design with a form. Offer another candidate that has one, or a `revise` that adds a contact section, then deliver again into an empty folder.

Do not say the feature was added.
