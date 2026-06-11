# Mabdel SmartFlow - Frontend AI Integration Spec
> **Target Audience**: Frontend Web/Mobile Client Developers (React, Vite, React Router v7, Zustand, Axios)
> **Objective**: Implement seamless AI-driven redirects, form auto-prefill, and voice commands for the Invoice creation workflow.

---

## 1. Core Integration Concepts

Mabdel's backend uses a LangGraph-based state machine that parses user chat/voice commands, extracts parameters, and returns **redirection instructions** (`navigation`) along with **form prefill data** (`prefill`).

The integration requires the frontend client to:
1. **Send** user commands (text or transcribed voice) to the AI endpoints.
2. **Listen** to the `navigation` object in the API response.
3. **Redirect** the user to the correct route (e.g., `/invoices/create`) if `should_redirect` is true.
4. **Populate** form fields instantly using the provided `prefill` parameters.

---

## 2. API Specifications & Payload Shapes

### A. AI Chat Endpoint
Use this endpoint when the user interacts with the Mabdel AI Chat UI.

* **Endpoint**: `POST /api/v1/smartflow/ai/chat`
* **Request Header**: `Authorization: Bearer <access_token>`
* **Request Body** (`AIChatRequest`):
```json
{
  "content": "Create an invoice of $500 for Arik",
  "response_mode": "text",
  "voice_id": null
}
```

* **Response Body Envelope** (`AIChatResponse`):
```json
{
  "status": "success",
  "message": "AI response generated successfully.",
  "data": {
    "conversation_id": "6648b2d...",
    "state": "responded",
    "user_message": { "content": "Create an invoice of $500 for Arik", "direction": "inbound" },
    "ai_message": { 
      "content": "Sure, opening the invoice creator now.", 
      "direction": "outbound",
      "command_history_id": "6648b30..."
    },
    "workflow": {
      "engine": "langgraph",
      "intent": "invoice",
      "summary": "Invoice workflow prepared.",
      "output": {
        "client_name": "Arik",
        "currency": "USD",
        "items": [
          { "description": "Service", "quantity": 1, "unit_price": 500.0 }
        ]
      }
    },
    "navigation": {
      "should_redirect": true,
      "action": "open_screen",
      "route_name": "invoice_create",
      "screen": "CreateInvoice",
      "path": "/invoices/create",
      "label": "Create Invoice",
      "params": {
        "source": "mabdel_ai",
        "prefill_prompt": "Create an invoice of $500 for Arik",
        "intent": "invoice"
      }
    },
    "audio": null
  }
}
```

---

### B. AI Form Prefill Endpoint (Voice/Action Prefill)
Use this when the user clicks a voice command button inside a specific form page to auto-fill additional fields, or when submitting directly from a microphone.

* **Endpoint**: `POST /api/v1/smartflow/ai/workflow-prefill`
* **Request Body** (`AIWorkflowPrefillRequest`):
```json
{
  "transcript": "Create an invoice of $500 for Arik at arik@example.com",
  "workflow_intent": "invoice",
  "current_values": {}
}
```

* **Response Body Envelope** (`AIWorkflowPrefillResponse`):
```json
{
  "status": "success",
  "message": "AI workflow form prefill generated successfully.",
  "data": {
    "state": "responded",
    "transcript": "Create an invoice of $500 for Arik at arik@example.com",
    "workflow": {
      "engine": "langgraph",
      "intent": "invoice",
      "summary": "Invoice workflow prepared."
    },
    "prefill": {
      "client_name": "Arik",
      "client_email": "arik@example.com",
      "currency": "USD",
      "tax_rate": 0,
      "notes": "Create an invoice of $500 for Arik at arik@example.com",
      "items": [
        { "description": "Service", "quantity": 1, "unit_price": 500.0 }
      ]
    },
    "missing_fields": ["due_date"],
    "ready_to_create": false,
    "create_endpoint": "/api/v1/invoices",
    "create_method": "POST",
    "submit_label": "Create Invoice",
    "next_action": "review_form",
    "navigation": {
      "should_redirect": true,
      "path": "/invoices/create"
    }
  }
}
```

---

## 3. Frontend Implementation Recipes (React)

### A. Global Navigation Orchestrator (Zustand + React Router v7)

To ensure the AI chat client can redirect the user from anywhere in the app, store the prefill payload globally or pass it as router state:

```typescript
// store/aiStore.ts
import { create } from "zustand";

interface AIWorkflowPrefill {
  client_name?: string;
  client_email?: string;
  currency?: string;
  items?: Array<{ description: string; quantity: number; unit_price: number }>;
  notes?: string;
}

interface AIState {
  activePrefill: AIWorkflowPrefill | null;
  setActivePrefill: (prefill: AIWorkflowPrefill | null) => void;
  clearPrefill: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  activePrefill: null,
  setActivePrefill: (prefill) => set({ activePrefill: prefill }),
  clearPrefill: () => set({ activePrefill: null }),
}));
```

### B. Chat Interface Navigation Handler
When receiving a response from the AI chat, process the redirect logic immediately:

```typescript
// components/AIChatInput.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAIStore } from "../store/aiStore";

export const AIChatInput: React.FC = () => {
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const setActivePrefill = useAIStore((state) => state.setActivePrefill);

  const handleSendMessage = async () => {
    try {
      const response = await axios.post("/api/v1/smartflow/ai/chat", {
        content: input,
      });

      const { navigation, workflow } = response.data.data;

      // 1. If the AI suggests a redirect
      if (navigation?.should_redirect && navigation.path) {
        
        // 2. If it is an invoice workflow, store extracted data
        if (navigation.params?.intent === "invoice" && workflow?.output) {
          const prefillData = {
            client_name: workflow.output.client_name || "",
            client_email: workflow.output.client_email || "",
            currency: workflow.output.currency || "USD",
            items: workflow.output.items || [],
            notes: navigation.params.prefill_prompt || "",
          };
          setActivePrefill(prefillData);
        }

        // 3. Perform redirect
        navigate(navigation.path);
      }
      
      setInput("");
    } catch (error) {
      console.error("AI Chat Error:", error);
    }
  };

  return (
    <div className="flex gap-2">
      <input 
        value={input} 
        onChange={(e) => setInput(e.target.value)} 
        placeholder="Ask Mabdel AI..." 
        className="flex-1 p-2 border rounded-md"
      />
      <button onClick={handleSendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-md">
        Send
      </button>
    </div>
  );
};
```

---

### C. Create Invoice Component Binding
Inside your `/invoices/create` screen, check the Zustand store for incoming prefilled values during initialization.

```tsx
// pages/CreateInvoice.tsx
import React, { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useAIStore } from "../store/aiStore";

interface InvoiceFormInputs {
  client_name: string;
  client_email: string;
  currency: string;
  notes: string;
  items: Array<{ description: string; quantity: number; unit_price: number }>;
}

export const CreateInvoice: React.FC = () => {
  const { activePrefill, clearPrefill } = useAIStore();
  
  const { register, control, handleSubmit, reset } = useForm<InvoiceFormInputs>({
    defaultValues: {
      client_name: "",
      client_email: "",
      currency: "USD",
      notes: "",
      items: [{ description: "Service", quantity: 1, unit_price: 0 }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  // Prefill hook trigger
  useEffect(() => {
    if (activePrefill) {
      reset({
        client_name: activePrefill.client_name || "",
        client_email: activePrefill.client_email || "",
        currency: activePrefill.currency || "USD",
        notes: activePrefill.notes || "",
        items: activePrefill.items && activePrefill.items.length > 0 
          ? activePrefill.items 
          : [{ description: "Service", quantity: 1, unit_price: 0 }],
      });
      
      // Clear prefill store so subsequent manual navigations start empty
      clearPrefill();
    }
  }, [activePrefill, reset, clearPrefill]);

  const onSubmit = async (data: InvoiceFormInputs) => {
    // POST to /api/v1/invoices
    console.log("Submitting Invoice:", data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">New Invoice</h1>
      
      <div>
        <label className="block text-sm font-medium">Client Name</label>
        <input {...register("client_name")} className="w-full border p-2 rounded" />
      </div>

      <div>
        <label className="block text-sm font-medium">Client Email</label>
        <input {...register("client_email")} className="w-full border p-2 rounded" />
      </div>

      <div>
        <label className="block text-sm font-medium">Items</label>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 mt-2">
            <input {...register(`items.${index}.description`)} placeholder="Description" className="flex-1 border p-2 rounded" />
            <input type="number" {...register(`items.${index}.quantity`)} placeholder="Qty" className="w-20 border p-2 rounded" />
            <input type="number" step="0.01" {...register(`items.${index}.unit_price`)} placeholder="Price" className="w-32 border p-2 rounded" />
            <button type="button" onClick={() => remove(index)} className="text-red-500">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => append({ description: "", quantity: 1, unit_price: 0 })} className="mt-2 text-blue-500 text-sm">
          + Add Item
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea {...register("notes")} className="w-full border p-2 rounded" rows={3} />
      </div>

      <button type="submit" className="w-full bg-green-600 text-white p-3 rounded font-bold">
        Create Invoice
      </button>
    </form>
  );
};
```

---

## 4. Key Security & Performance Rules
1. **Clear Prefill State**: Always invoke `clearPrefill()` immediately after binding values inside `useEffect`. This ensures that if the user leaves the page and navigates back manually, they see a clean, empty form instead of cached AI draft entries.
2. **Graceful Falling back**: If the API does not return a `workflow` block or standard extraction fields, the UI must remain functional. Let the user fill out fields manually if the AI model fails to extract them.
3. **Decimal Handling**: Ensure input prices are converted properly. The backend tracks pricing unit values (e.g. `unit_price` float or `cents` integer). Format decimal strings safely prior to submitting payloads.
