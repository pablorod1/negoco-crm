CREATE TABLE account (                                                                                                                                                                           
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  account_id TEXT NOT NULL,                                                                                                                                                                      
  provider_id TEXT NOT NULL,                                                                                                                                                                     
  user_id TEXT NOT NULL,                                                                                                                                                                         
  access_token TEXT,                                                                                                                                                                             
  refresh_token TEXT,                                                                                                                                                                            
  id_token TEXT,                                                                                                                                                                                 
  access_token_expires_at INTEGER,                                                                                                                                                               
  refresh_token_expires_at INTEGER,                                                                                                                                                              
  scope TEXT,                                                                                                                                                                                    
  password TEXT,                                                                                                                                                                                 
  created_at INTEGER NOT NULL,                                                                                                                                                                   
  updated_at INTEGER NOT NULL,                                                                                                                                                                   
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE                                                                                                                                    
);                                                                                                                                                                                               
CREATE TABLE clients (                                                                                                                                                                           
    id TEXT PRIMARY KEY NOT NULL,                                                                                                                                                                
    name TEXT NOT NULL,                                                                                                                                                                          
    last_name TEXT NOT NULL,                                                                                                                                                                     
    type TEXT NOT NULL,                                                                                                                                                                          
    email TEXT NOT NULL,                                                                                                                                                                         
    phone TEXT NOT NULL,                                                                                                                                                                         
    IBAN TEXT NOT NULL,                                                                                                                                                                          
    document_type TEXT NOT NULL,                                                                                                                                                                 
    document_number TEXT NOT NULL,                                                                                                                                                               
    address TEXT NOT NULL                                                                                                                                                                        
, "postal_code" TEXT NOT NULL DEFAULT "", "province" TEXT NOT NULL DEFAULT "", "city" TEXT NOT NULL DEFAULT "", `coordinates` text DEFAULT '""');                                                
CREATE TABLE `comercializadora_rates` (                                                                                                                                                          
	`id` text PRIMARY KEY NOT NULL,                                                                                                                                                                  
	`name` text,                                                                                                                                                                                     
	`price` real,                                                                                                                                                                                    
	`created_at` text,                                                                                                                                                                               
	`updated_at` text,                                                                                                                                                                               
	`comercializadora_id` text, `type` text,                                                                                                                                                         
	FOREIGN KEY (`comercializadora_id`) REFERENCES `comercializadoras`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION                                                                                 
);                                                                                                                                                                                               
CREATE TABLE "comercializadoras" (                                                                                                                                                               
	`id` text PRIMARY KEY,                                                                                                                                                                           
	`name` text NOT NULL,                                                                                                                                                                            
	`active` numeric DEFAULT '''false''' NOT NULL                                                                                                                                                    
, `logo` text);                                                                                                                                                                                  
CREATE INDEX idx_comercializadoras_active_name                                                                                                                                                   
  ON comercializadoras(active, name ASC);                                                                                                                                                        
CREATE INDEX idx_comercializadoras_name                                                                                                                                                          
  ON comercializadoras(name);                                                                                                                                                                    
CREATE INDEX idx_comercializadoras_active                                                                                                                                                        
  ON comercializadoras(active);                                                                                                                                                                  
CREATE INDEX idx_comercializadoras_active_only                                                                                                                                                   
  ON comercializadoras(name ASC) WHERE active = true;                                                                                                                                            
CREATE TABLE comparativa_changes (                                                                                                                                                               
    id TEXT PRIMARY KEY NOT NULL,                                                                                                                                                                
    comparativa_id TEXT NOT NULL,                                                                                                                                                                
    user_id TEXT,                                                                                                                                                                                
    change_type TEXT NOT NULL CHECK (change_type IN (                                                                                                                                            
        'created',                                                                                                                                                                               
        'status_change',                                                                                                                                                                         
        'field_update',                                                                                                                                                                          
        'client_update',                                                                                                                                                                         
        'service_update',                                                                                                                                                                        
        'plan_update',                                                                                                                                                                           
        'commission_update',                                                                                                                                                                     
        'assignment_change',                                                                                                                                                                     
        'document_upload',                                                                                                                                                                       
        'document_delete',                                                                                                                                                                       
        'note_added',                                                                                                                                                                            
        'note_deleted',                                                                                                                                                                          
        'converted_to_contract',                                                                                                                                                                 
        'general_update',                                                                                                                                                                        
        'deleted'                                                                                                                                                                                
    )),                                                                                                                                                                                          
    field_name TEXT NULL,                                                                                                                                                                        
    old_value TEXT NULL,                                                                                                                                                                         
    new_value TEXT NULL,                                                                                                                                                                         
    description TEXT NULL,                                                                                                                                                                       
    created_at TEXT NOT NULL DEFAULT (datetime('now')),                                                                                                                                          
                                                                                                                                                                                                 
    FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE,                                                                                                                  
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL                                                                                                                                 
);                                                                                                                                                                                               
CREATE INDEX idx_comparativa_changes_comparativa_id ON comparativa_changes(comparativa_id);                                                                                                      
CREATE INDEX idx_comparativa_changes_user_id ON comparativa_changes(user_id);                                                                                                                    
CREATE INDEX idx_comparativa_changes_created_at ON comparativa_changes(created_at);                                                                                                              
CREATE INDEX idx_comparativa_changes_change_type ON comparativa_changes(change_type);                                                                                                            
CREATE INDEX idx_comparativa_changes_comparativa_date ON comparativa_changes(comparativa_id, created_at DESC);                                                                                   
CREATE TABLE comparativa_files (                                                                                                                                                                 
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  comparativa_id TEXT NOT NULL,                                                                                                                                                                  
  filename TEXT NOT NULL,                                                                                                                                                                        
  size INTEGER NOT NULL,                                                                                                                                                                         
  extension TEXT NOT NULL,                                                                                                                                                                       
  upload_date TEXT NOT NULL,                                                                                                                                                                     
  download_url TEXT NOT NULL,                                                                                                                                                                    
  preview_url TEXT,                                                                                                                                                                              
  FOREIGN KEY (comparativa_id) REFERENCES comparativas (id) ON DELETE CASCADE                                                                                                                    
);                                                                                                                                                                                               
CREATE TABLE comparativas (                                                                                                                                                                      
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  client TEXT NOT NULL,                                                                                                                                                                          
  service TEXT CHECK (service IN ('Luz', 'Gas')) NOT NULL,                                                                                                                                       
  plan TEXT  NOT NULL,                                                                                                                                                                           
  comision_fijo REAL NOT NULL,                                                                                                                                                                   
  comision_indexado REAL NOT NULL,                                                                                                                                                               
  comision_sales_person_fijo REAL NOT NULL,                                                                                                                                                      
  comision_sales_person_indexado REAL NOT NULL,                                                                                                                                                  
  notes TEXT,                                                                                                                                                                                    
  user_id TEXT NOT NULL,                                                                                                                                                                         
  creation_date TEXT NOT NULL,                                                                                                                                                                   
  status TEXT NOT NULL,                                                                                                                                                                          
  tramite_id TEXT, company_id TEXT,                                                                                                                                                              
  FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,                                                                                                                                  
  FOREIGN KEY (tramite_id) REFERENCES tramites (id) ON DELETE CASCADE                                                                                                                            
);                                                                                                                                                                                               
CREATE INDEX idx_comparativas_company_id                                                                                                                                                         
  ON comparativas(company_id);                                                                                                                                                                   
CREATE INDEX idx_comparativas_status_company                                                                                                                                                     
  ON comparativas(status, company_id);                                                                                                                                                           
CREATE INDEX idx_comparativas_user_company                                                                                                                                                       
  ON comparativas(user_id, company_id);                                                                                                                                                          
CREATE TABLE contracts (                                                                                                                                                                         
  id TEXT PRIMARY KEY NOT NULL,                                                                                                                                                                  
  type TEXT NOT NULL,                                                                                                                                                                            
  province TEXT NOT NULL,                                                                                                                                                                        
  city TEXT NOT NULL,                                                                                                                                                                            
  address TEXT NOT NULL,                                                                                                                                                                         
  postal_code TEXT NOT NULL,                                                                                                                                                                     
  "new_company" TEXT NOT NULL,                                                                                                                                                                   
  plan TEXT NOT NULL,                                                                                                                                                                            
  consumption INTEGER DEFAULT 0,                                                                                                                                                                 
  CUPS TEXT NOT NULL,                                                                                                                                                                            
  pot1 INTEGER DEFAULT 0,                                                                                                                                                                        
  pot2 INTEGER DEFAULT 0,                                                                                                                                                                        
  pot3 INTEGER DEFAULT 0,                                                                                                                                                                        
  pot4 INTEGER DEFAULT 0,                                                                                                                                                                        
  pot5 INTEGER DEFAULT 0,                                                                                                                                                                        
  pot6 INTEGER DEFAULT 0,                                                                                                                                                                        
  description TEXT,                                                                                                                                                                              
  tramite_id TEXT, "old_company" TEXT NOT NULL DEFAULT "",                                                                                                                                       
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE                                                                                                                             
);                                                                                                                                                                                               
CREATE INDEX idx_contracts_new_company                                                                                                                                                           
  ON contracts(new_company);                                                                                                                                                                     
CREATE INDEX idx_contracts_old_company                                                                                                                                                           
  ON contracts(old_company);                                                                                                                                                                     
CREATE INDEX idx_contracts_company_tramite                                                                                                                                                       
  ON contracts(new_company, tramite_id);                                                                                                                                                         
CREATE INDEX idx_contracts_company_consumption                                                                                                                                                   
  ON contracts(new_company, consumption);                                                                                                                                                        
CREATE TABLE documentacion_files (                                                                                                                                                               
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  name TEXT NOT NULL,                                                                                                                                                                            
  size INTEGER,                                                                                                                                                                                  
  extension TEXT,                                                                                                                                                                                
  upload_date TEXT,                                                                                                                                                                              
  download_url TEXT,                                                                                                                                                                             
  preview_url TEXT,                                                                                                                                                                              
  folder_name TEXT NOT NULL,                                                                                                                                                                     
  type TEXT NOT NULL                                                                                                                                                                             
);                                                                                                                                                                                               
CREATE TABLE `fotovoltaica` (                                                                                                                                                                    
	`id` text PRIMARY KEY NOT NULL,                                                                                                                                                                  
	`type` text DEFAULT 'PPA' NOT NULL,                                                                                                                                                              
	`client` text NOT NULL,                                                                                                                                                                          
	`client_type` text DEFAULT 'Empresa' NOT NULL,                                                                                                                                                   
	`location` text NOT NULL,                                                                                                                                                                        
	`coordinates` text,                                                                                                                                                                              
	`creation_date` text NOT NULL,                                                                                                                                                                   
	`activation_date` text,                                                                                                                                                                          
	`status` text NOT NULL,                                                                                                                                                                          
	`notes` text,                                                                                                                                                                                    
	`internal_notes` text,                                                                                                                                                                           
	`user_id` text NOT NULL, `comision` real DEFAULT '0' NOT NULL, `comision_sales_person` real DEFAULT '0' NOT NULL, `updated_by` text, `updated_at` text,                                          
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION                                                                                                          
);                                                                                                                                                                                               
CREATE INDEX `user_id` ON `fotovoltaica` (`id`,`user_id`);                                                                                                                                       
CREATE TABLE "fotovoltaica_files" (                                                                                                                                                              
	`id` text PRIMARY KEY NOT NULL UNIQUE,                                                                                                                                                           
	`fotovoltaica_id` text NOT NULL,                                                                                                                                                                 
	`filename` text,                                                                                                                                                                                 
	`size` real,                                                                                                                                                                                     
	`extension` text,                                                                                                                                                                                
	`upload_date` text,                                                                                                                                                                              
	`download_url` text,                                                                                                                                                                             
	`preview_url` text,                                                                                                                                                                              
	FOREIGN KEY (`fotovoltaica_id`) REFERENCES `fotovoltaica`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE                                                                                            
);                                                                                                                                                                                               
CREATE INDEX `fotovoltaica_id` ON `fotovoltaica_files` (`fotovoltaica_id`);                                                                                                                      
CREATE TABLE invitation (                                                                                                                                                                        
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  organization_id TEXT NOT NULL,                                                                                                                                                                 
  email TEXT NOT NULL,                                                                                                                                                                           
  role TEXT,                                                                                                                                                                                     
  status TEXT NOT NULL,                                                                                                                                                                          
  expires_at INTEGER NOT NULL,                                                                                                                                                                   
  inviter_id TEXT NOT NULL,                                                                                                                                                                      
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE,                                                                                                                   
  FOREIGN KEY (inviter_id) REFERENCES user(id) ON DELETE CASCADE                                                                                                                                 
);                                                                                                                                                                                               
CREATE TABLE member (                                                                                                                                                                            
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  organization_id TEXT NOT NULL,                                                                                                                                                                 
  user_id TEXT NOT NULL,                                                                                                                                                                         
  role TEXT NOT NULL,                                                                                                                                                                            
  created_at INTEGER NOT NULL,                                                                                                                                                                   
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE,                                                                                                                   
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE                                                                                                                                    
);                                                                                                                                                                                               
CREATE TABLE notifications (                                                                                                                                                                     
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  message TEXT NOT NULL,                                                                                                                                                                         
  context TEXT NOT NULL,                                                                                                                                                                         
  link TEXT,                                                                                                                                                                                     
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                                                                                                                                                
  priority INTEGER NOT NULL,                                                                                                                                                                     
  user_id TEXT NOT NULL, title TEXT NOT NULL, "client" TEXT,                                                                                                                                     
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE                                                                                                                                    
);                                                                                                                                                                                               
CREATE TABLE "objectives"(                                                                                                                                                                       
  "id" TEXT PRIMARY KEY NOT NULL,                                                                                                                                                                
  "type" TEXT NOT NULL,                                                                                                                                                                          
  "peak" REAL NOT NULL,                                                                                                                                                                          
  "current" REAL NOT NULL,                                                                                                                                                                       
  "period" TEXT NOT NULL,                                                                                                                                                                        
  "created_at" TEXT NOT NULL,                                                                                                                                                                    
  "completed" INTEGER NOT NULL DEFAULT '0',                                                                                                                                                      
  "user_id" TEXT NOT NULL REFERENCES "user"("id"),                                                                                                                                               
  FOREIGN KEY ("user_id") REFERENCES "user" ("id")                                                                                                                                               
);                                                                                                                                                                                               
CREATE TABLE "organization" (                                                                                                                                                                    
	`id` text PRIMARY KEY UNIQUE,                                                                                                                                                                    
	`name` text NOT NULL,                                                                                                                                                                            
	`slug` text UNIQUE,                                                                                                                                                                              
	`logo` text,                                                                                                                                                                                     
	`created_at` integer NOT NULL,                                                                                                                                                                   
	`metadata` text,                                                                                                                                                                                 
	`plan` text DEFAULT '''1''' NOT NULL                                                                                                                                                             
);                                                                                                                                                                                               
CREATE TABLE plans (                                                                                                                                                                             
    id INTEGER PRIMARY KEY,                                                                                                                                                                      
    name TEXT NOT NULL,                                                                                                                                                                          
    max_members INTEGER                                                                                                                                                                          
);                                                                                                                                                                                               
-- Plans: 1=starter, 2=pro, 3=elite, 4=comparador                                                                                                                                                                                               
CREATE TABLE session (                                                                                                                                                                           
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  expires_at INTEGER NOT NULL,                                                                                                                                                                   
  token TEXT NOT NULL UNIQUE,                                                                                                                                                                    
  created_at INTEGER NOT NULL,                                                                                                                                                                   
  updated_at INTEGER NOT NULL,                                                                                                                                                                   
  ip_address TEXT,                                                                                                                                                                               
  user_agent TEXT,                                                                                                                                                                               
  user_id TEXT NOT NULL,                                                                                                                                                                         
  active_organization_id TEXT,                                                                                                                                                                   
  impersonated_by TEXT,                                                                                                                                                                          
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE                                                                                                                                    
);                                                                                                                                                                                               
CREATE TABLE signers (                                                                                                                                                                           
    id TEXT PRIMARY KEY,                                                                                                                                                                         
    name TEXT NOT NULL,                                                                                                                                                                          
    last_name TEXT NOT NULL,                                                                                                                                                                     
    email TEXT NOT NULL,                                                                                                                                                                         
    phone TEXT NOT NULL,                                                                                                                                                                         
    document_number TEXT NOT NULL,                                                                                                                                                               
    cargo TEXT,                                                                                                                                                                                  
    client_id TEXT NOT NULL,                                                                                                                                                                     
                                                                                                                                                                                                 
    -- Clave foránea para enlazar con la tabla clients                                                                                                                                           
    CONSTRAINT fk_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE                                                                                                        
);                                                                                                                                                                                               
CREATE TABLE ticket_replies (                                                                                                                                                                    
    id TEXT PRIMARY KEY,                                                                                                                                                                         
    ticket_id TEXT NOT NULL,                                                                                                                                                                     
    message TEXT NOT NULL,                                                                                                                                                                       
    author_id TEXT NOT NULL,                                                                                                                                                                     
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,                                                                                                                                               
                                                                                                                                                                                                 
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE ON UPDATE CASCADE,                                                                                                          
    FOREIGN KEY (author_id) REFERENCES user(id)                                                                                                                                                  
);                                                                                                                                                                                               
CREATE INDEX idx_replies_ticket ON ticket_replies(ticket_id);                                                                                                                                    
CREATE TABLE ticket_statuses (                                                                                                                                                                   
    id INTEGER PRIMARY KEY,                                                                                                                                                                      
    name TEXT NOT NULL UNIQUE,                                                                                                                                                                   
    sort_order INTEGER NOT NULL                                                                                                                                                                  
);                                                                                                                                                                                               
CREATE TABLE ticket_types (                                                                                                                                                                      
    id INTEGER PRIMARY KEY,                                                                                                                                                                      
    name TEXT NOT NULL UNIQUE,                                                                                                                                                                   
    description TEXT                                                                                                                                                                             
);                                                                                                                                                                                               
CREATE TABLE tickets (                                                                                                                                                                           
    id TEXT PRIMARY KEY,                                                                                                                                                                         
    subject TEXT NOT NULL,                                                                                                                                                                       
    message TEXT NOT NULL,                                                                                                                                                                       
    is_internal BOOLEAN NOT NULL DEFAULT 0,                                                                                                                                                      
    status_id INTEGER NOT NULL,                                                                                                                                                                  
    type_id INTEGER NOT NULL,                                                                                                                                                                    
    context TEXT NOT NULL CHECK (context IN ('tramite', 'cliente', 'fotovoltaica', 'comparativa')),                                                                                              
    ref_id TEXT NOT NULL, -- dynamic FK: references table depending on context                                                                                                                   
    priority TEXT CHECK (priority IN ('low','medium','high','urgent')) DEFAULT 'medium',                                                                                                         
    created_by TEXT NOT NULL,                                                                                                                                                                    
    assigned_to TEXT,                                                                                                                                                                            
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,                                                                                                                                               
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,                                                                                                                                               
                                                                                                                                                                                                 
    FOREIGN KEY (status_id) REFERENCES ticket_statuses(id),                                                                                                                                      
    FOREIGN KEY (type_id) REFERENCES ticket_types(id),                                                                                                                                           
    FOREIGN KEY (created_by) REFERENCES user(id),                                                                                                                                                
    FOREIGN KEY (assigned_to) REFERENCES user(id)                                                                                                                                                
);                                                                                                                                                                                               
CREATE INDEX idx_tickets_status ON tickets(status_id);                                                                                                                                           
CREATE INDEX idx_tickets_type ON tickets(type_id);                                                                                                                                               
CREATE INDEX idx_tickets_context_ref ON tickets(context, ref_id);                                                                                                                                
CREATE TABLE tramite_changes (                                                                                                                                                                   
    id TEXT PRIMARY KEY NOT NULL,                                                                                                                                                                
    tramite_id TEXT NOT NULL,                                                                                                                                                                    
    user_id TEXT,                                                                                                                                                                                
    change_type TEXT NOT NULL CHECK (change_type IN (                                                                                                                                            
        'created',                                                                                                                                                                               
        'status_change',                                                                                                                                                                         
        'field_update',                                                                                                                                                                          
        'client_update',                                                                                                                                                                         
        'signer_update',                                                                                                                                                                         
        'document_upload',                                                                                                                                                                       
        'document_delete',                                                                                                                                                                       
        'note_added',                                                                                                                                                                            
        'assignment_change',                                                                                                                                                                     
        'contract_created',                                                                                                                                                                      
        'contract_updated',                                                                                                                                                                      
        'contract_deleted',                                                                                                                                                                      
        'commission_update',                                                                                                                                                                     
        'date_update',                                                                                                                                                                           
        'provider_update',                                                                                                                                                                       
        'renewal_created',                                                                                                                                                                       
        'renewal_updated'                                                                                                                                                                        
    )),                                                                                                                                                                                          
    field_name TEXT NULL,                                                                                                                                                                        
    old_value TEXT NULL,                                                                                                                                                                         
    new_value TEXT NULL,                                                                                                                                                                         
    description TEXT NULL,                                                                                                                                                                       
    created_at TEXT NOT NULL DEFAULT (datetime('now')),                                                                                                                                          
                                                                                                                                                                                                 
    FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,                                                                                                                          
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL                                                                                                                                 
);                                                                                                                                                                                               
CREATE INDEX idx_tramite_changes_tramite_id ON tramite_changes(tramite_id);                                                                                                                      
CREATE INDEX idx_tramite_changes_user_id ON tramite_changes(user_id);                                                                                                                            
CREATE INDEX idx_tramite_changes_created_at ON tramite_changes(created_at);                                                                                                                      
CREATE INDEX idx_tramite_changes_change_type ON tramite_changes(change_type);                                                                                                                    
CREATE INDEX idx_tramite_changes_tramite_date ON tramite_changes(tramite_id, created_at DESC);                                                                                                   
CREATE TABLE tramite_files (                                                                                                                                                                     
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  tramite_id TEXT NOT NULL,                                                                                                                                                                      
  filename TEXT NOT NULL,                                                                                                                                                                        
  size INTEGER NOT NULL,                                                                                                                                                                         
  extension TEXT NOT NULL,                                                                                                                                                                       
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,                                                                                                                                                
  download_url TEXT NOT NULL,                                                                                                                                                                    
  preview_url TEXT,                                                                                                                                                                              
  FOREIGN KEY (tramite_id) REFERENCES tramites (id) ON DELETE CASCADE                                                                                                                            
);                                                                                                                                                                                               
CREATE TABLE tramites (                                                                                                                                                                          
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  creation_date TEXT NOT NULL,                                                                                                                                                                   
  tramitation_date TEXT NOT NULL,                                                                                                                                                                
  activation_date TEXT NOT NULL,                                                                                                                                                                 
  renovation_date TEXT NOT NULL,                                                                                                                                                                 
  sales_name TEXT NOT NULL,                                                                                                                                                                      
  comision_sales_person REAL NOT NULL,                                                                                                                                                           
  comision REAL NOT NULL,                                                                                                                                                                        
  status TEXT NOT NULL,                                                                                                                                                                          
  liquidez_status TEXT,                                                                                                                                                                          
  notes TEXT,                                                                                                                                                                                    
  client_id TEXT,                                                                                                                                                                                
  user_id TEXT, "updated_by" TEXT REFERENCES "user"("id"), "updated_at" TEXT, "collection_date" TEXT, "payment_date" TEXT, "rejected_date" TEXT, `internal_notes` text, provider TEXT, plan,     
  FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,                                                                                                                             
  FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE SET NULL                                                                                                                                  
);                                                                                                                                                                                               
CREATE INDEX idx_tramites_status ON tramites(status);                                                                                                                                            
CREATE INDEX idx_tramites_sales_name ON tramites(sales_name);                                                                                                                                    
CREATE INDEX idx_tramites_creation_date ON tramites(creation_date);                                                                                                                              
CREATE INDEX idx_tramites_sales_name_lower ON tramites(LOWER(sales_name));                                                                                                                       
CREATE INDEX idx_tramites_status_sales_name ON tramites(status, sales_name);                                                                                                                     
CREATE INDEX idx_tramites_activation_date ON tramites(activation_date);                                                                                                                          
CREATE INDEX idx_tramites_status_id                                                                                                                                                              
  ON tramites(status, id);                                                                                                                                                                       
CREATE INDEX idx_tramites_user_status                                                                                                                                                            
  ON tramites(user_id, status);                                                                                                                                                                  
CREATE TABLE user (                                                                                                                                                                              
    id TEXT PRIMARY KEY,                                                                                                                                                                         
    name TEXT NOT NULL,                                                                                                                                                                          
    email TEXT NOT NULL UNIQUE,                                                                                                                                                                  
    email_verified BOOLEAN NOT NULL,                                                                                                                                                             
    image TEXT,                                                                                                                                                                                  
    created_at TIMESTAMP NOT NULL,                                                                                                                                                               
    updated_at TIMESTAMP NOT NULL,                                                                                                                                                               
    role TEXT,                                                                                                                                                                                   
    banned BOOLEAN,                                                                                                                                                                              
    ban_reason TEXT,                                                                                                                                                                             
    ban_expires TIMESTAMP,                                                                                                                                                                       
    super_id TEXT, should_reset_password INTEGER NOT NULL DEFAULT 1, "company" TEXT,                                                                                                             
    FOREIGN KEY (super_id) REFERENCES user(id) ON DELETE CASCADE                                                                                                                                 
);                                                                                                                                                                                               
CREATE TABLE verification (                                                                                                                                                                      
  id TEXT PRIMARY KEY,                                                                                                                                                                           
  identifier TEXT NOT NULL,                                                                                                                                                                      
  value TEXT NOT NULL,                                                                                                                                                                           
  expires_at INTEGER NOT NULL,                                                                                                                                                                   
  created_at INTEGER,                                                                                                                                                                            
  updated_at INTEGER                                                                                                                                                                             
);                                                                                                                                                                                               
