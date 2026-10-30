# SEVENS fork of TeamAI

这是 [Tencent/teamai-cli](https://github.com/Tencent/teamai-cli) 的 SEVENS 团队 fork。和上游只差一件事：**技能的分享与安装交给 Skill Pilot**，TeamAI 不再往任何 AI 工具的技能目录写技能，也不把技能提交进团队仓库。规则、文档、审阅、钩子等其余功能保持上游行为。

- 包名 `sevens-teamai-cli`，命令仍是 `teamai`（已注入的钩子写死 `teamai hook-dispatch`）。
- 安装 / 手动升级：`npm install -g https://github.com/Simonlau4/sevens-teamai-cli/releases/latest/download/sevens-teamai-cli.tgz`
- 不要装 npm 上的 `teamai-cli`：那是上游原版，会把技能重新投递进各工具。
- 上游 LICENSE 与版权声明原样保留（MIT）。

## 补丁清单

每处改动都带 `SEVENS:` 注释；`grep -rn "SEVENS:" src skill-data skills` 列出全部。fork 专属常量和文案集中在 `src/sevens.ts`，技能相关的守卫都读 `SKILL_PILOT_MANAGES_SKILLS`。

| # | 改了什么 | 为什么 | 文件 |
| --- | --- | --- | --- |
| 1 | 包名改为 `sevens-teamai-cli` | 上游在没有本地/团队配置时默认 `auto` 升级，Stop 钩子会执行 `npm install -g <包名>`；同名就会被换回原版 | `package.json`、`package-lock.json`、`src/package-info.ts`（注释） |
| 2 | 升级来源改为 fork 的 GitHub Release：未认证请求 `releases/latest` 取 `tag_name`，从附件 `sevens-teamai-cli-<版本>.tgz` 安装，不再传 `--registry`（依赖走成员自己的 npm 源）。12 小时缓存、锁、安装后核对、钩子刷新不变；网络失败静默跳过 | 同上 | `src/update.ts` |
| 3 | `compareVersions` 两边都带预发布后缀时按 semver §11 比较 | 上游判 `0.28.1-sevens.1` 与 `0.28.1-sevens.2` 相同，fork 的小版本永远不会升级 | `src/update.ts` |
| 4 | 应投递技能集合恒为空（`resolveDesiredSkills` 返回空 `items`，保留 `teamItems`）。pull 不再投递团队技能；以前由 TeamAI 投递、内容未改的副本由上游的 Step 3b 清理（与团队仓库当前版本相同，或投递记录证明未改 `isUneditedSkillCopy`），改过的保留并提示 | 技能由 Skill Pilot 分发 | `src/resources/desired.ts`、`src/pull.ts`（中文提示） |
| 5 | 内置 `teamai` 技能不再投递；以前投递的副本只在全部文件都是发布过的原样时清理，成员加过或改过任何文件就整份保留并提示（上游是逐文件删，会删掉 `SKILL.md` 只留成员文件） | 同上 | `src/builtin-skills.ts` |
| 5b | 删除前检查从基准目录到副本的每一级：经过任何符号链接（单个技能链接，或整个技能目录链到 Skill Pilot 正本库）就不删。团队技能的所有删除路径都经过 `mayDeleteSkillCopy`，一并加上 | 上游允许 HOME 内的根目录链接，会顺着链接删掉 `~/.skill-pilot/store` 里的文件 | `src/sevens.ts`（`reachedThroughLink`）、`src/builtin-skills.ts`、`src/resources/skills.ts` |
| 6 | 补上上游 0.28.0–0.28.1 的 `teamai` 技能文件指纹（`UPSTREAM_STUB_DIGESTS`） | 上游靠“当前包里那份”识别自己的 stub；fork 改了这个文件，否则旧版投递的副本会被当成成员自己的、永远清不掉 | `src/sevens.ts`、`src/builtin-skills.ts` |
| 7 | 工作流技能不放置，未编辑的旧副本由上游清理逻辑移除；doctor 不再报“被遮挡的工作流技能” | 工作流技能也是技能，团队目前用不上 | `src/workflow/discovery/workflow-skills.ts` |
| 8 | push 前的预同步不再写技能 | 同上 | `src/utils/pre-push-sync.ts` |
| 9 | `teamai push --skill` 直接退出（exit 1）并提示去 Skill Pilot；`push` / `push --all` 不再收集技能，发现本该推送的技能时提示一行 | 技能在 Skill Pilot 看板「团队」→「上架技能」上架 | `src/push.ts`、`src/resources/skills.ts` |
| 10 | doctor 的技能目录检查换成一条“技能由 Skill Pilot 管理” | TeamAI 不写技能，这些检查没有意义 | `src/doctor-delivery.ts` |
| 11 | init 结束时提示技能由 Skill Pilot 管理，不再报“teamai 技能没投递” | 同上 | `src/init.ts` |
| 11b | `--http` 模式（本地 agent）收到 `install_skill` 时报错并提示 Skill Pilot，不写技能 | 同上 | `src/local-agent.ts` |
| 12 | Agent 读的说明：发布技能改为引导到 Skill Pilot（成员与管理员指南）；安装命令换成 fork 的 tarball；`teamai` 技能和工作流说明去掉 `npx teamai-cli`（npx 会跑上游原版）；排障文档加 fork 的 issues 链接 | 同上 | `skills/teamai/SKILL.md`、`skill-data/core/`、`skill-data/setup/`、`skill-data/share/SKILL.md`、`skill-data/workflow*/`、`src/skill-content.ts` |

fork 新增的提示是中文（团队用），这一点和上游“CLI 输出一律英文”的规则不同，是有意的。

`teamai` 技能本身也由 Skill Pilot 分发：在 Skill Pilot 技能页粘贴本仓库 `skills/teamai` 的 GitHub 链接安装，或在团队分享站上架。

## 有意没改的

- `teamai skill get <workflow>` 照常从包里的 `skill-data/` 读说明，不写任何技能目录。
- 经验分享（`skill-data/share` 其余部分）不变；它依赖 `sharing.recall.enabled`，团队配置当前关闭。
- 工作流 skill driver 在从 npx 缓存运行时会打印 `npx teamai-cli`（`src/workflow/drivers/skill/literals.ts`），未改：fork 只按全局安装分发，工作流技能也不放置。
- pull 的快速路径（团队仓库没变时直接返回）不做技能清理，与上游一致。从上游版切到 fork 后跑一次 `teamai pull --force`，旧副本才会被清理；之后团队仓库一有变化，普通 pull 也会清理。
- 团队仓库还留着某个技能、而 Skill Pilot 用链接装了同名技能时，链接不会被删；如果两边内容不同，上游每次完整 pull 会提示一行“Kept skill … local changes”。团队仓库删掉 `skills/` 后消失。
- recall 的搜索索引随“应投递技能为空”不再包含技能。
- `teamai remove skill`、`teamai status`、`teamai skill list` 等只读或删除路径保持上游行为。

## 测试

- **上游测试在开关关闭下跑**：`src/__tests__/helpers/sevens-upstream-tests.ts`（`vitest.config.ts` 的 setupFiles）对文件名不以 `sevens-` 开头的测试，把 `SKILL_PILOT_MANAGES_SKILLS` mock 成 `false`。上游有约 280 个用例在断言技能会被投递，逐个改会让每次同步上游都冲突；这样它们继续守住上游其余逻辑。
- **fork 行为在开关打开下跑**：`src/__tests__/sevens-skill-pilot.test.ts`、`src/__tests__/sevens-http-install.test.ts`（第 4–11b 项；把开关改成 `false` 时 12 个用例中 11 个失败；剩下的“根目录链接到正本库”用例针对 `reachedThroughLink`，让它恒返回 `false` 时失败，均已核对）、`src/__tests__/e2e/sevens-skill-pilot.test.ts`（真实 CLI，需先 `npm run build`，`npm run test:e2e -- src/__tests__/e2e/sevens-skill-pilot.test.ts`）。第 1–3 项在 `src/__tests__/update.test.ts`，与开关无关。
- 因 fork 改了文档而调整的上游断言只有两处（`skill-content.test.ts`、`workflow-skill-literals.test.ts`：`teamai` 技能不再预授权 `npx teamai-cli`），都带 `SEVENS:` 注释。
- 给 Agent 读的 `skills/`、`skill-data/` 仍保持全英文（上游测试检查），中文界面名只出现在 CLI 提示里。
- 上游 v0.28.1 未改动时本机就失败的 7 个用例（`self-mode-agents`、`submodule-checkout`、`workflow-pr-providers`）与 fork 无关：前者在设置了 `CODEX_HOME` 的机器上必失败，后两个与本机 git 钩子配置和计时有关。

## 版本与发布

版本号 `<上游版本>-sevens.<N>`，例如 `0.28.1-sevens.1`。同一上游版本上的 fork 修订递增 N；rebase 到新上游版本时 N 从 1 开始。

发布（每一步都需要 Simon 批准 push 和 release）：

```bash
npm version 0.28.1-sevens.1 --no-git-tag-version
npm run build && npm test && npm run typecheck && npm run lint
npm pack                                   # 生成 sevens-teamai-cli-0.28.1-sevens.1.tgz
cp sevens-teamai-cli-0.28.1-sevens.1.tgz sevens-teamai-cli.tgz
git commit -am "chore(release): 0.28.1-sevens.1" && git tag v0.28.1-sevens.1
git push origin sevens v0.28.1-sevens.1        # 只推这一个 tag；--tags 会把上游的 tag 全推上去
gh release create v0.28.1-sevens.1 sevens-teamai-cli-0.28.1-sevens.1.tgz sevens-teamai-cli.tgz \
  --repo Simonlau4/sevens-teamai-cli --title v0.28.1-sevens.1 --notes "..."
```

- Release 不能是 draft 或 prerelease：`releases/latest` 不返回这两种，自动升级会看不到。
- 两个附件缺一不可：带版本号的给自动升级用，固定名 `sevens-teamai-cli.tgz` 给安装命令的 `releases/latest/download/` 用。
- 发布后在一个干净目录验证：`npm install -g <上面的 latest 链接>`，`teamai --version`。

## 同步上游

1. `git fetch upstream --tags`
2. `git rebase --onto <新上游 tag> <旧上游 tag> sevens`，冲突时保留 `SEVENS:` 补丁的意图。
3. 上游的 `skills/teamai/SKILL.md` 如果变了：`git show <新上游 tag>:skills/teamai/SKILL.md | shasum -a 256`，把新指纹加进 `src/sevens.ts` 的 `UPSTREAM_STUB_DIGESTS`。
4. `grep -rn "teamai-cli@\|install -g teamai-cli\|npx teamai-cli" skills skill-data`，新出现的安装命令换成 fork 的。
5. `npm test`、`npm run typecheck`、`npm run lint`。
6. 按上面的步骤发布 `<新上游版本>-sevens.1`。
