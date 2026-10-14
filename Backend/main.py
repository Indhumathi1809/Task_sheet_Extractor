from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import pandas as pd
import numpy as np
import io
import requests
import re
import json

app = FastAPI(title="Excel Data Extractor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=False, # MUST be False if allow_origins is ["*"]
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .xls or .xlsx file.")
    
    try:
        contents = await file.read()
        
        # Explicitly tell pandas which engine to use for BytesIO
        engine = 'xlrd' if file.filename.endswith('.xls') else 'openpyxl'
        df = pd.read_excel(io.BytesIO(contents), engine=engine)
        
        # Replace NaN values with None (which becomes null in JSON)
        df = df.replace({np.nan: None})
        
        # Extract columns and rows
        columns = df.columns.tolist()
        data = df.to_dict(orient="records")
        
        return {
            "columns": columns,
            "data": data,
            "filename": file.filename
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class FormFetchRequest(BaseModel):
    url: str

class FormSubmitRequest(BaseModel):
    url: str
    data: List[Dict[str, Any]]
    mapping: Dict[str, str]
    types: Dict[str, int] = {}

@app.post("/api/fetch-form-fields")
def fetch_form_fields(req: FormFetchRequest):
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        resp = requests.get(req.url, headers=headers)
        resp.raise_for_status()
        
        match = re.search(r'var FB_PUBLIC_LOAD_DATA_ = (\[.*?\]);', resp.text, re.DOTALL)
        if not match:
            raise ValueError("Could not find form data. Make sure the URL is a public Google Forms viewform URL.")
        
        data = json.loads(match.group(1))
        items = data[1][1]
        fields = []
        
        for item in items:
            if len(item) > 4 and item[4] and isinstance(item[4], list):
                try:
                    entry_id = item[4][0][0]
                    label = item[1]
                    field_type = item[3]
                    fields.append({"id": f"entry.{entry_id}", "label": label, "type": field_type})
                except Exception:
                    pass
                    
        return {"fields": fields}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/submit-form")
def submit_form(req: FormSubmitRequest):
    # Clean up and resolve submit_url
    submit_url = req.url
    
    # Resolve short links if necessary
    if 'forms.gle' in submit_url:
        try:
            resp = requests.get(submit_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
            submit_url = resp.url
        except:
            pass
            
    # Remove query parameters
    submit_url = submit_url.split('?')[0]

    # Convert to formResponse
    if '/viewform' in submit_url:
        submit_url = submit_url.replace('/viewform', '/formResponse')
    elif '/edit' in submit_url:
        submit_url = submit_url.replace('/edit', '/formResponse')
    elif not submit_url.endswith('/formResponse'):
        if submit_url.endswith('/'):
            submit_url += 'formResponse'
        else:
            submit_url += '/formResponse'
            
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    success_count = 0
    errors = []
    
    for i, row in enumerate(req.data):
        payload = {}
        for entry_id, excel_col in req.mapping.items():
            if not excel_col:
                continue # Skip unmapped fields
            if excel_col in row:
                val = row[excel_col]
                if val is None:
                    payload[entry_id] = ""
                    continue
                
                val_str = str(val).strip()
                field_type = req.types.get(entry_id)
                
                if field_type == 9: # Google Forms Date type
                    parts_space = val_str.split(" ")
                    date_part = parts_space[0]
                    time_part = parts_space[1] if len(parts_space) > 1 else None
                    
                    parts = date_part.split("-")
                    if len(parts) >= 3:
                        payload[f"{entry_id}_year"] = parts[0]
                        payload[f"{entry_id}_month"] = parts[1]
                        payload[f"{entry_id}_day"] = parts[2]
                        if time_part:
                            time_parts = time_part.split(":")
                            if len(time_parts) >= 2:
                                payload[f"{entry_id}_hour"] = time_parts[0]
                                payload[f"{entry_id}_minute"] = time_parts[1]
                    else:
                        payload[entry_id] = val_str
                else:
                    payload[entry_id] = val_str
        
        try:
            resp = requests.post(submit_url, data=payload, headers=headers)
            if resp.status_code == 200:
                success_count += 1
            else:
                print(f"FAILED PAYLOAD FOR ROW {i+1}:", payload)
                print(f"GOOGLE FORMS RESPONSE FOR ROW {i+1}:", resp.text)
                errors.append(f"Row {i+1} failed with status {resp.status_code}")
        except Exception as e:
            print(f"EXCEPTION FOR ROW {i+1}:", payload, str(e))
            errors.append(f"Row {i+1} exception: {str(e)}")
            
    return {
        "status": "success" if not errors else "partial_success",
        "submitted_count": success_count,
        "errors": errors
    }

@app.get("/")
def read_root():
    return {"message": "Excel Data Extractor API is running"}
