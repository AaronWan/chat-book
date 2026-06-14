#!/usr/bin/env python3
"""聊书 PDF 生成器 - fpdf2 + 系统中文字体"""
import json, sys
from fpdf import FPDF
import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)

FONT_PATH = '/System/Library/Fonts/Supplemental/Songti.ttc'

def generate_pdf(book_title, book_id, progress, total, now, chapter_notes, core_reflections, action_changes):
    pdf = FPDF()
    pdf.add_page()
    pdf.add_font('Heiti', '', FONT_PATH)
    pdf.add_font('HeitiB', '', FONT_PATH)

    def set_font(size, bold=False, color='#1B1814'):
        family = 'HeitiB' if bold else 'Heiti'
        pdf.set_font(family, size=size)
        r = int(color[1:3], 16)
        g = int(color[3:5], 16)
        b = int(color[5:7], 16)
        pdf.set_text_color(r, g, b)

    # 标题
    set_font(20, bold=True)
    pdf.cell(0, 14, book_title, new_x='LMARGIN', new_y='NEXT', align='C')
    set_font(10, color='#888888')
    pdf.cell(0, 7, f'聊书笔记  |  生成时间: {now}  |  阅读进度: {progress}/{total} 章', new_x='LMARGIN', new_y='NEXT', align='C')
    pdf.ln(8)
    pdf.set_draw_color(230, 221, 203)
    pdf.set_line_width(0.5)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(10)

    def write_bullet_list(items, indent=25, bullet='-'):
        set_font(10, color='#3B342B')
        for item in items:
            if isinstance(item, dict):
                item = item.get('text', item.get('user', item.get('author', str(item))))
            text = f'{bullet} {item}'
            pdf.set_x(indent)
            pdf.multi_cell(0, 6, text)

    # 章节笔记
    for cn in chapter_notes:
        chIdx = cn.get('chapter_index', 0)
        title = cn.get('title', f'第{chIdx}章')
        set_font(14, bold=True)
        pdf.cell(0, 9, title, new_x='LMARGIN', new_y='NEXT')
        pdf.ln(2)

        core = cn.get('core_insights') or cn.get('core_reflections') or []
        if core:
            set_font(11, bold=True, color='#8C4A2B')
            pdf.cell(0, 7, '核心洞察', new_x='LMARGIN', new_y='NEXT')
            pdf.ln(1)
            write_bullet_list(core)
            pdf.ln(4)

        collisions = cn.get('collisions') or []
        if collisions:
            set_font(11, bold=True, color='#8C4A2B')
            pdf.cell(0, 7, '延伸思考', new_x='LMARGIN', new_y='NEXT')
            pdf.ln(1)
            write_bullet_list(collisions)
            pdf.ln(4)

        pdf.ln(4)

    # 全书总评
    if core_reflections:
        if pdf.get_y() > 250:
            pdf.add_page()
        set_font(13, bold=True)
        pdf.cell(0, 9, '全书总评', new_x='LMARGIN', new_y='NEXT')
        pdf.ln(2)
        write_bullet_list(core_reflections)
        pdf.ln(6)

    # 行动改变
    if action_changes:
        if pdf.get_y() > 250:
            pdf.add_page()
        set_font(13, bold=True)
        pdf.cell(0, 9, '行动改变', new_x='LMARGIN', new_y='NEXT')
        pdf.ln(2)
        write_bullet_list(action_changes, bullet='>')
        pdf.ln(6)

    # 页脚
    pdf.set_y(-20)
    set_font(9, color='#AAAAAA')
    pdf.cell(0, 6, f'由聊书生成  |  {now}', new_x='LMARGIN', new_y='NEXT', align='C')

    return pdf.output()

if __name__ == '__main__':
    try:
        data = json.load(sys.stdin)
        output_path = sys.argv[1] if len(sys.argv) > 1 else None
        pdf_bytes = generate_pdf(
            data['book_title'], data['book_id'],
            data['progress'], data['total'],
            data['now'],
            data.get('chapter_notes', []),
            data.get('core_reflections', []),
            data.get('action_changes', [])
        )
        if output_path:
            with open(output_path, 'wb') as f:
                f.write(pdf_bytes)
        else:
            sys.stdout.buffer.write(pdf_bytes)
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)