export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            customers: {
                Row: {
                    id: string
                    name: string
                    kana: string | null
                    email: string | null
                    phone: string | null
                    line_id: string | null
                    customer_type: string | null
                    notes: string | null
                    created_at: string | null
                    updated_at: string | null
                    lstep_url: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    kana?: string | null
                    email?: string | null
                    phone?: string | null
                    line_id?: string | null
                    customer_type?: string | null
                    notes?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    lstep_url?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    kana?: string | null
                    email?: string | null
                    phone?: string | null
                    line_id?: string | null
                    customer_type?: string | null
                    notes?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    lstep_url?: string | null
                }
                Relationships: []
            }
            inquiries: {
                Row: {
                    id: string
                    customer_id: string | null
                    company: string
                    channel: string
                    direction: string
                    category: string | null
                    status: string
                    subject: string | null
                    content: string | null
                    answer: string | null
                    notes: string | null
                    assignee: string | null
                    received_at: string | null
                    created_at: string | null
                    updated_at: string | null
                    source_account: string | null
                    original_sender: string | null
                }
                Insert: {
                    id?: string
                    customer_id?: string | null
                    company: string
                    channel: string
                    direction: string
                    category?: string | null
                    status?: string
                    subject?: string | null
                    content?: string | null
                    answer?: string | null
                    notes?: string | null
                    assignee?: string | null
                    received_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    source_account?: string | null
                    original_sender?: string | null
                }
                Update: {
                    id?: string
                    customer_id?: string | null
                    company?: string
                    channel?: string
                    direction?: string
                    category?: string | null
                    status?: string
                    subject?: string | null
                    content?: string | null
                    answer?: string | null
                    notes?: string | null
                    assignee?: string | null
                    received_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    source_account?: string | null
                    original_sender?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "inquiries_customer_id_fkey"
                        columns: ["customer_id"]
                        referencedRelation: "customers"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
