import KeyGenerator from '@/app/components/KeyGenerator'

export default function GetKeyPage() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-20">
      <h1 className="mb-4 text-4xl font-bold">Get Key</h1>

      <p className="mb-8 text-gray-400">Generate a free key to use LuxyHub scripts.</p>

      <KeyGenerator />
    </main>
  )
}
