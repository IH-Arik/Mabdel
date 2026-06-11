import docx
import sys

def read_docx(file_path):
    try:
        doc = docx.Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            full_text.append(para.text)
        return '\n'.join(full_text)
    except Exception as e:
        return str(e)

if __name__ == "__main__":
    file_path = r"c:\Users\ittes\Desktop\Arik\Desktop\ARIK\Mabdel\mabdel24 __ $4500(+1500+1200) __ Mobile App + Web __ Farvez Hossen.docx"
    print(read_docx(file_path))
