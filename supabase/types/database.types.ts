// Hand-authored starter types for the Cyber Samachar Supabase schema.
// Replace with generated output after the Supabase CLI is available:
// supabase gen types typescript --project-id cawwrszyytuerotvykpw > supabase/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      published_data: {
        Row: {
          id: string;
          processed_id: string | null;
          generated_headline: string | null;
          generated_article: string | null;
          card_image_url: string | null;
          social_copy: string | null;
          metadata: Json;
          categories: string[];
          sub_categories: string[];
          tags: string[];
          severity: string | null;
          track: string | null;
          is_general: boolean | null;
          is_technical: boolean | null;
          india_relevant: boolean | null;
          is_breaking: boolean | null;
          source_name: string | null;
          source_domain: string | null;
          original_url: string | null;
          original_published_at: string | null;
          published_at: string;
          status: string | null;
          view_count: number;
          share_count: number;
          like_count: number;
          save_count: number;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['published_data']['Row']>;
        Update: Partial<Database['public']['Tables']['published_data']['Row']>;
      };
      categories: {
        Row: {
          id: string;
          label_en: string;
          label_hi: string | null;
          description: string | null;
          icon_key: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['categories']['Row']> & { id: string; label_en: string };
        Update: Partial<Database['public']['Tables']['categories']['Row']>;
      };
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          audience: 'general' | 'professional';
          language: string;
          preferred_categories: string[];
          notification_channels: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { user_id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      bookmarks: {
        Row: {
          user_id: string;
          article_id: string;
          created_at: string;
        };
        Insert: { user_id: string; article_id: string };
        Update: never;
      };
      reports: {
        Row: {
          id: string;
          user_id: string | null;
          crime_type: string;
          city: string | null;
          incident_at: string | null;
          loss_amount: number | null;
          channel: string | null;
          mapped_sections: string[];
          status: 'submitted' | 'triaged' | 'referred' | 'closed';
          consent_version: string;
          sensitive_data_ciphertext: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['reports']['Row']> & { crime_type: string; consent_version: string };
        Update: Partial<Pick<Database['public']['Tables']['reports']['Row'], 'status' | 'updated_at'>>;
      };
    };
    Functions: {
      get_feed: {
        Args: { cat?: string | null; audience?: string | null; q?: string | null; page?: number; page_size?: number };
        Returns: Database['public']['Tables']['published_data']['Row'][];
      };
      get_article: {
        Args: { article_id: string };
        Returns: { article: Json; related_laws: Json; related_articles: Json }[];
      };
      get_archive: {
        Args: { year?: number; audience?: string | null };
        Returns: { archive_year: number; archive_month: number; total_count: number; critical_count: number; breach_count: number; articles: Json }[];
      };
      record_article_view: {
        Args: { article_id: string; anon_id?: string | null };
        Returns: Json;
      };
      toggle_article_like: {
        Args: { article_id: string; anon_id?: string | null };
        Returns: Json;
      };
      submit_report: {
        Args: { payload: Json };
        Returns: string;
      };
      get_report_status: {
        Args: { report_id: string };
        Returns: Array<{
          id: string;
          crime_type: string;
          city: string | null;
          incident_at: string | null;
          loss_amount: number | null;
          channel: string | null;
          mapped_sections: string[];
          status: 'submitted' | 'triaged' | 'referred' | 'closed';
          created_at: string;
          updated_at: string;
        }>;
      };
    };
  };
}
