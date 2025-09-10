'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, X, FileText, Files, Send, Bot, User, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentSelector } from './document-selector'

interface ChatBotProps {
  className?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ApiResponse {
  response: string
  conversation_id: string
  sources?: string[]
}

interface Document {
  filename: string
  type: string
  pages?: number[]
}

interface DocumentSummary {
  total_documents: number
  document_types: Record<string, number>
  filenames: string[]
}

export function ChatBot({ className }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentView, setCurrentView] = useState<'menu' | 'chat' | 'document-selector'>('menu')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const API_BASE_URL = 'http://localhost:8000'

  const toggleChatBot = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setCurrentView('menu')
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (currentView === 'chat' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentView])



  const handleSelectDocuments = () => {
    setCurrentView('document-selector')
  }

  const handleProcessSelected = async (selectedDocuments: string[]) => {
    setIsProcessing(true)
    try {
      const response = await fetch(`${API_BASE_URL}/documents/process-selective`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'selective',
          selected_files: selectedDocuments 
        }),
      })

      if (response.ok) {
        const result = await response.json()
        // Clear any existing messages and start fresh
        setMessages([])
        setConversationId(null)
        
        // Add welcome message with processing results
        addMessage('assistant', `Hello! I've successfully processed ${selectedDocuments.length} document(s) for you:\n\n${selectedDocuments.map(doc => `• ${doc}`).join('\n')}\n\nYou can now ask me questions about these documents. What would you like to know?`)
        setCurrentView('chat')
      } else {
        const errorData = await response.json()
        setMessages([])
        addMessage('assistant', `Error processing selected documents: ${errorData.detail || 'Unknown error'}. Please try selecting documents again.`)
        setCurrentView('chat')
      }
    } catch (error) {
      console.error('Error processing selected documents:', error)
      setMessages([])
      addMessage('assistant', 'Sorry, I encountered an error while processing selected documents. Please make sure the backend server is running and try again.')
      setCurrentView('chat')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelDocumentSelection = () => {
    setCurrentView('menu')
  }



  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, newMessage])
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    addMessage('user', userMessage)
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: conversationId,
        }),
      })

      if (response.ok) {
        const data: ApiResponse = await response.json()
        setConversationId(data.conversation_id)
        addMessage('assistant', data.response)
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        addMessage('assistant', `❌ Sorry, I encountered an error processing your request: ${errorData.detail || 'Please try again or select documents first.'}`)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      addMessage('assistant', '❌ Sorry, I could not connect to the server. Please make sure the backend is running and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const goBackToMenu = () => {
    setCurrentView('menu')
    // Don't clear messages here - let user return to chat if needed
  }

  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to clear all chatbot data? This will delete all conversations, documents from memory, and files in the fixed_json directory. This action cannot be undone.')) {
      return
    }

    try {
      setIsClearing(true)
      const response = await fetch(`${API_BASE_URL}/cleanup/all`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        const data = await response.json()
        // Reset local state
        setMessages([])
        setConversationId(null)
        
        // Show success message and stay in chat to see the result
        addMessage('assistant', `✅ Cleanup completed successfully: ${data.message}\n\nYou can now select new documents to process.`)
        setCurrentView('chat')
      } else {
        console.error('Failed to clear data')
        setMessages([])
        addMessage('assistant', '❌ Sorry, I could not clear the data. Please try again or check if the backend server is running properly.')
        setCurrentView('chat')
      }
    } catch (error) {
      console.error('Error clearing data:', error)
      setMessages([])
      addMessage('assistant', '❌ Sorry, I encountered an error while clearing data. Please make sure the backend server is running and try again.')
      setCurrentView('chat')
    } finally {
      setIsClearing(false)
    }
  }

  const handleClearConversations = async () => {
    if (!confirm('Are you sure you want to clear all conversation history?')) {
      return
    }

    try {
      setIsClearing(true)
      const response = await fetch(`${API_BASE_URL}/cleanup/conversations`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        const data = await response.json()
        // Reset local conversation state
        setMessages([])
        setConversationId(null)
        
        addMessage('assistant', `✅ ${data.message}\n\nYour conversation history has been cleared. You can continue chatting with your documents.`)
        setCurrentView('chat')
      } else {
        console.error('Failed to clear conversations')
        setMessages([])
        addMessage('assistant', '❌ Sorry, I could not clear the conversations. Please try again or check if the backend server is running properly.')
        setCurrentView('chat')
      }
    } catch (error) {
      console.error('Error clearing conversations:', error)
      setMessages([])
      addMessage('assistant', '❌ Sorry, I encountered an error while clearing conversations. Please make sure the backend server is running and try again.')
      setCurrentView('chat')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className={cn('fixed bottom-4 right-0 z-20', className)} style={{right: '15px'}}>
      {/* Chat Interface */}
      <div
        className={cn(
          'mb-2 transition-all duration-300 ease-in-out transform origin-bottom-right absolute bottom-9 right-20',
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
        )}
      >
        <Card className="w-80 sm:w-96 max-w-[calc(100vw-3rem)] shadow-2xl border-0 bg-white/98 backdrop-blur-md rounded-2xl">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Document Assistant</h3>
                  <p className="text-sm text-gray-500">
                    {currentView === 'menu' ? 'How can I help you today?' : 
                     currentView === 'document-selector' ? 'Choose documents to process' :
                     'Chat with your documents'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {(currentView === 'chat' || currentView === 'document-selector') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goBackToMenu}
                    className="h-8 w-8 p-0 hover:bg-gray-100"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleChatBot}
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Menu View */}
            {currentView === 'menu' && (
              <>
                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={handleSelectDocuments}
                    disabled={isProcessing}
                    className="w-full justify-start gap-3 h-12 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  >
                    <Files className="w-5 h-5" />
                    <div className="text-left">
                      <div className="font-medium">Select Documents</div>
                      <div className="text-xs text-blue-100">Choose specific documents to process</div>
                    </div>
                  </Button>
                  
                  {messages.length > 0 && (
                    <Button
                      onClick={() => setCurrentView('chat')}
                      variant="outline"
                      className="w-full justify-start gap-3 h-10 border-green-200 hover:bg-green-50 hover:border-green-300"
                    >
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">Continue Chat</div>
                        <div className="text-xs text-gray-500">{messages.length} message{messages.length !== 1 ? 's' : ''}</div>
                      </div>
                    </Button>
                  )}
                </div>

                {/* Cleanup Section */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-3">Data Management</p>
                  <div className="space-y-2">
                    <Button
                      onClick={handleClearConversations}
                      disabled={isClearing}
                      variant="outline"
                      className="w-full justify-start gap-3 h-10 border-orange-200 hover:bg-orange-50 hover:border-orange-300 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 text-orange-600" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">Clear Conversations</div>
                      </div>
                    </Button>
                    
                    <Button
                      onClick={handleClearAllData}
                      disabled={isClearing}
                      variant="outline"
                      className="w-full justify-start gap-3 h-10 border-red-200 hover:bg-red-50 hover:border-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">Clear All Data</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 text-center">
                    Choose an option to get started with document processing
                  </p>
                </div>
              </>
            )}





            {/* Document Selector View */}
            {currentView === 'document-selector' && (
              <DocumentSelector
                onProcessSelected={handleProcessSelected}
                onCancel={handleCancelDocumentSelection}
                isProcessing={isProcessing}
              />
            )}

            {/* Chat View */}
            {currentView === 'chat' && (
              <>
                {/* Header */}
                <div className="mb-4">
                  <Button
                    onClick={goBackToMenu}
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-gray-600 hover:text-gray-900"
                  >
                    ← Back to Menu
                  </Button>
                </div>

                {/* Messages */}
                <ScrollArea className="h-64 mb-4 pr-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-3',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          )}
                        >
                          {message.content}
                        </div>
                        {message.role === 'user' && (
                          <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                            <User className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="w-3 h-3 text-white" />
                        </div>
                        <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
                          Thinking...
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={messagesEndRef} />
                </ScrollArea>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your documents..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    size="sm"
                    className="px-3"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Bubble */}
      <Button
        onClick={toggleChatBot}
        className={cn(
          'w-16 h-16 rounded-full shadow-xl transition-all duration-300 ease-in-out',
          'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white',
          'hover:scale-110 active:scale-95 border-2 border-white/20',
          isOpen && 'rotate-180'
        )}
      >
        {isOpen ? (
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        )}
      </Button>
    </div>
  )
}

export default ChatBot