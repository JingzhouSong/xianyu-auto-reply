"""一次性脚本：清除被误填为系统 admin 的 cookies 表 username/password。

用法：python scripts/clear_wrong_login_info.py
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'xianyu_data.db')

if not os.path.exists(DB_PATH):
    print(f'数据库不存在: {DB_PATH}')
    sys.exit(1)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

print('清理前:')
cur.execute('SELECT id, username, length(password) AS pwd_len FROM cookies')
for row in cur.fetchall():
    print(' ', row)

cur.execute("UPDATE cookies SET username='', password='' WHERE username='admin'")
print(f'\n更新行数: {cur.rowcount}')
conn.commit()

print('\n清理后:')
cur.execute('SELECT id, username, length(password) AS pwd_len FROM cookies')
for row in cur.fetchall():
    print(' ', row)

conn.close()
print('\n完成。请在前端"账号管理 → 编辑账号 → 登录信息"中重新填入真实的闲鱼手机号/邮箱与密码。')
