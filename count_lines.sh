#!/bin/bash
for f in "E:/yuwenjun_ready/my_notes/docs/notes/前端学习路线/第六阶段-React开发进阶/6.6-React表单处理-React-Hook-Form与Zod校验.md" "E:/yuwenjun_ready/my_notes/docs/notes/前端学习路线/第六阶段-React开发进阶/6.7-React路由-React-Router进阶.md" "E:/yuwenjun_ready/my_notes/docs/notes/前端学习路线/第六阶段-React开发进阶/6.8-服务端数据管理-TanStack-Query.md" "E:/yuwenjun_ready/my_notes/docs/notes/前端学习路线/第六阶段-React开发进阶/6.9-表格解决方案-TanStack-Table.md"; do
  lines=$(cat "$f" | wc -l)
  echo "$lines - $f"
done
