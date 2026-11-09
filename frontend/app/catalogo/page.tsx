"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import BookCatalog from "@/components/catalogos/BookCatalog";
import { fetchCatalogoPage, type LibroPublico } from "@/lib/catalogos";

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export default function CatalogoPage() {
  const [books, setBooks] = useState<LibroPublico[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const requestedPage = page;

    fetchCatalogoPage({
      page: requestedPage,
      perPage: PER_PAGE,
      query: appliedQuery,
      signal: controller.signal,
    })
      .then(({ books: nextBooks, pagination }) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setBooks((currentBooks) =>
          requestedPage === 1
            ? nextBooks
            : [...currentBooks, ...nextBooks],
        );
        setHasNext(Boolean(pagination?.has_next));
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (
          controller.signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar el catálogo.",
        );
        setHasNext(false);
      })
      .finally(() => {
        if (
          controller.signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        loadingMoreRef.current = false;
        setLoadingInitial(false);
        setLoadingMore(false);
      });

    return () => controller.abort();
  }, [appliedQuery, page, reloadKey]);

  const loadMore = useCallback(() => {
    if (loadingInitial || loadingMore || loadingMoreRef.current || !hasNext) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPage((currentPage) => currentPage + 1);
  }, [hasNext, loadingInitial, loadingMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      requestIdRef.current += 1;
      loadingMoreRef.current = false;
      setBooks([]);
      setPage(1);
      setHasNext(true);
      setError(null);
      setLoadingInitial(true);
      setLoadingMore(false);
      setAppliedQuery(value.trim());
      setReloadKey((currentKey) => currentKey + 1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const retry = useCallback(() => {
    requestIdRef.current += 1;
    setError(null);
    setHasNext(true);

    if (books.length === 0) {
      setLoadingInitial(true);
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    setReloadKey((currentKey) => currentKey + 1);
  }, [books.length]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <header className="mb-8 flex flex-col items-center text-center">
        <Image
          src="/img/logo.jpg"
          alt="Vargas Editorial"
          width={260}
          height={120}
          priority
          className="h-auto max-h-16 w-auto object-contain"
        />
        <h1 className="mt-4 text-3xl font-extrabold text-ink">
          Vargas Editorial
        </h1>
        <p className="mt-1 text-sm text-muted">
          Catálogo público de encuadernación y edición.
        </p>
      </header>

      <BookCatalog
        books={books}
        query={query}
        onQueryChange={handleQueryChange}
        error={error}
        loadingInitial={loadingInitial}
        loadingMore={loadingMore}
        hasNext={hasNext}
        onRetry={retry}
        sentinelRef={sentinelRef}
      />
    </div>
  );
}
