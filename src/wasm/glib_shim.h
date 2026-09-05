/**
 * @file glib_shim.h
 * @brief Minimal GLib 2.0 replacement shim for Sharp MZ-800 WebAssembly port.
 *
 * Provides drop-in compatibility for common GLib data types, memory allocators,
 * strings, path utilities, and synchronization primitives without linking the
 * multi-megabyte desktop libglib-2.0 library.
 */

#ifndef GLIB_SHIM_H
#define GLIB_SHIM_H

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <stdarg.h>
#include <time.h>
#include <unistd.h>
#include <sys/stat.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Basic Types */
typedef int gboolean;
#ifndef TRUE
#define TRUE 1
#endif
#ifndef FALSE
#define FALSE 0
#endif

typedef char gchar;
typedef unsigned char guchar;
typedef int gint;
typedef unsigned int guint;
typedef short gshort;
typedef unsigned short gushort;
typedef long glong;
typedef unsigned long gulong;
typedef int8_t gint8;
typedef uint8_t guint8;
typedef int16_t gint16;
typedef uint16_t guint16;
typedef int32_t gint32;
typedef uint32_t guint32;
typedef int64_t gint64;
typedef uint64_t guint64;
typedef float gfloat;
typedef double gdouble;
typedef size_t gsize;
typedef ssize_t gssize;
typedef uint16_t gunichar2;
#ifndef G_N_ELEMENTS
#define G_N_ELEMENTS(arr) (sizeof(arr) / sizeof((arr)[0]))
#endif
typedef void* gpointer;
typedef const void* gconstpointer;

#define GINT_TO_POINTER(v)   ((gpointer)(intptr_t)(v))
#define GPOINTER_TO_INT(p)   ((gint)(intptr_t)(p))
#define GUINT_TO_POINTER(v)  ((gpointer)(uintptr_t)(v))
#define GPOINTER_TO_UINT(p)  ((guint)(uintptr_t)(p))

#ifndef G_GUINT64_FORMAT
#define G_GUINT64_FORMAT "llu"
#endif
#ifndef G_GINT64_FORMAT
#define G_GINT64_FORMAT "lld"
#endif
#ifndef G_GSIZE_FORMAT
#define G_GSIZE_FORMAT "zu"
#endif

static inline gboolean g_once_init_enter(void *location) {
    gsize *loc = (gsize*)location;
    if (*loc == 0) return TRUE;
    return FALSE;
}

static inline void g_once_init_leave(void *location, gsize result) {
    gsize *loc = (gsize*)location;
    *loc = result;
}

static inline gboolean g_ascii_isdigit(gchar c) {
    return (c >= '0' && c <= '9');
}

typedef void (*GDestroyNotify)(gpointer data);
typedef gint (*GCompareFunc)(gconstpointer a, gconstpointer b);
typedef gint (*GCompareDataFunc)(gconstpointer a, gconstpointer b, gpointer user_data);

#ifndef G_MAXINT64
#define G_MAXINT64 9223372036854775807LL
#endif

#ifndef GLIB_CHECK_VERSION
#define GLIB_CHECK_VERSION(major, minor, micro) (1)
#endif

/* Memory Allocation */
static inline gpointer g_malloc(gsize n_bytes) {
    if (n_bytes == 0) return NULL;
    gpointer p = malloc(n_bytes);
    if (!p) { fprintf(stderr, "Out of memory in g_malloc(%zu)\n", n_bytes); abort(); }
    return p;
}

static inline gpointer g_malloc0(gsize n_bytes) {
    if (n_bytes == 0) return NULL;
    gpointer p = calloc(1, n_bytes);
    if (!p) { fprintf(stderr, "Out of memory in g_malloc0(%zu)\n", n_bytes); abort(); }
    return p;
}

static inline gpointer g_realloc(gpointer mem, gsize n_bytes) {
    if (n_bytes == 0) { free(mem); return NULL; }
    gpointer p = realloc(mem, n_bytes);
    if (!p) { fprintf(stderr, "Out of memory in g_realloc(%zu)\n", n_bytes); abort(); }
    return p;
}

static inline void g_free(gpointer mem) {
    free(mem);
}

#define g_new(struct_type, n_structs) \
    ((struct_type *) g_malloc(sizeof(struct_type) * (size_t)(n_structs)))

#define g_new0(struct_type, n_structs) \
    ((struct_type *) g_malloc0(sizeof(struct_type) * (size_t)(n_structs)))

#define g_renew(struct_type, mem, n_structs) \
    ((struct_type *) g_realloc((mem), sizeof(struct_type) * (size_t)(n_structs)))

static inline gpointer g_memdup(gconstpointer mem, guint byte_size) {
    if (!mem || byte_size == 0) return NULL;
    gpointer out = g_malloc(byte_size);
    memcpy(out, mem, byte_size);
    return out;
}

static inline gpointer g_memdup2(gconstpointer mem, gsize byte_size) {
    if (!mem || byte_size == 0) return NULL;
    gpointer out = g_malloc(byte_size);
    memcpy(out, mem, byte_size);
    return out;
}

static inline void g_qsort_with_data(gconstpointer pbase, gint total_elems, gsize size, GCompareDataFunc compare_func, gpointer user_data) {
    if (!pbase || total_elems <= 1 || size == 0) return;
    char *base = (char*)pbase;
    char *tmp = (char*)malloc(size);
    for (gint i = 1; i < total_elems; i++) {
        memcpy(tmp, base + i * size, size);
        gint j = i - 1;
        while (j >= 0 && compare_func(base + j * size, tmp, user_data) > 0) {
            memcpy(base + (j + 1) * size, base + j * size, size);
            j--;
        }
        memcpy(base + (j + 1) * size, tmp, size);
    }
    free(tmp);
}

#define g_sort_array g_qsort_with_data

/* String Utilities */
static inline gchar* g_strdup(const gchar *str) {
    if (!str) return NULL;
    return strdup(str);
}

static inline gchar* g_strdup_printf(const gchar *format, ...) {
    va_list args, args_copy;
    va_start(args, format);
    va_copy(args_copy, args);
    int len = vsnprintf(NULL, 0, format, args);
    va_end(args);
    if (len < 0) { va_end(args_copy); return NULL; }
    gchar *res = (gchar*)g_malloc(len + 1);
    vsnprintf(res, len + 1, format, args_copy);
    va_end(args_copy);
    return res;
}

static inline gint g_strcmp0(const gchar *str1, const gchar *str2) {
    if (!str1) return -(str1 != str2);
    if (!str2) return str1 != str2;
    return strcmp(str1, str2);
}

static inline gboolean g_str_has_prefix(const gchar *str, const gchar *prefix) {
    if (!str || !prefix) return FALSE;
    return (strncmp(str, prefix, strlen(prefix)) == 0);
}

static inline gboolean g_str_has_suffix(const gchar *str, const gchar *suffix) {
    if (!str || !suffix) return FALSE;
    size_t str_len = strlen(str);
    size_t suf_len = strlen(suffix);
    if (str_len < suf_len) return FALSE;
    return (strcmp(str + str_len - suf_len, suffix) == 0);
}

/* Logging and Diagnostics */
#define g_print(...)   printf(__VA_ARGS__)
#define g_printerr(...) fprintf(stderr, __VA_ARGS__)
#define g_message(...)  do { printf("[MESSAGE] "); printf(__VA_ARGS__); printf("\n"); } while(0)
#define g_warning(...)  do { fprintf(stderr, "[WARNING] "); fprintf(stderr, __VA_ARGS__); fprintf(stderr, "\n"); } while(0)
#define g_error(...)    do { fprintf(stderr, "[ERROR] "); fprintf(stderr, __VA_ARGS__); fprintf(stderr, "\n"); abort(); } while(0)

#define g_return_if_fail(expr) do { if (!(expr)) return; } while(0)
#define g_return_val_if_fail(expr, val) do { if (!(expr)) return (val); } while(0)

/* GString */
typedef struct {
    gchar *str;
    gsize len;
    gsize allocated_len;
} GString;

static inline GString* g_string_new(const gchar *init) {
    GString *s = g_new(GString, 1);
    s->len = init ? strlen(init) : 0;
    s->allocated_len = s->len + 16;
    s->str = (gchar*)g_malloc(s->allocated_len);
    if (init) memcpy(s->str, init, s->len);
    s->str[s->len] = '\0';
    return s;
}

static inline gchar* g_string_free(GString *string, gboolean free_segment) {
    if (!string) return NULL;
    gchar *res = string->str;
    if (free_segment) {
        g_free(string->str);
        res = NULL;
    }
    g_free(string);
    return res;
}

static inline GString* g_string_append(GString *string, const gchar *val) {
    if (!string || !val) return string;
    gsize val_len = strlen(val);
    if (string->len + val_len + 1 > string->allocated_len) {
        string->allocated_len = (string->len + val_len + 1) * 2;
        string->str = (gchar*)g_realloc(string->str, string->allocated_len);
    }
    memcpy(string->str + string->len, val, val_len);
    string->len += val_len;
    string->str[string->len] = '\0';
    return string;
}

static inline GString* g_string_append_c(GString *string, gchar c) {
    if (!string) return string;
    if (string->len + 2 > string->allocated_len) {
        string->allocated_len = (string->len + 16) * 2;
        string->str = (gchar*)g_realloc(string->str, string->allocated_len);
    }
    string->str[string->len++] = c;
    string->str[string->len] = '\0';
    return string;
}

static inline void g_string_append_printf(GString *string, const gchar *format, ...) {
    va_list args;
    va_start(args, format);
    char buf[1024];
    int len = vsnprintf(buf, sizeof(buf), format, args);
    va_end(args);
    if (len > 0) g_string_append(string, buf);
}

static inline void g_string_printf(GString *string, const gchar *format, ...) {
    if (!string) return;
    string->len = 0;
    string->str[0] = '\0';
    va_list args;
    va_start(args, format);
    char buf[1024];
    int len = vsnprintf(buf, sizeof(buf), format, args);
    va_end(args);
    if (len > 0) g_string_append(string, buf);
}

/* GSList and GList */
typedef struct _GSList {
    gpointer data;
    struct _GSList *next;
} GSList;

typedef struct _GList {
    gpointer data;
    struct _GList *next;
    struct _GList *prev;
} GList;

static inline GSList* g_slist_append(GSList *list, gpointer data) {
    GSList *new_node = g_new0(GSList, 1);
    new_node->data = data;
    if (!list) return new_node;
    GSList *curr = list;
    while (curr->next) curr = curr->next;
    curr->next = new_node;
    return list;
}

static inline void g_slist_free(GSList *list) {
    while (list) {
        GSList *next = list->next;
        g_free(list);
        list = next;
    }
}

static inline GList* g_list_append(GList *list, gpointer data) {
    GList *new_node = g_new0(GList, 1);
    new_node->data = data;
    if (!list) return new_node;
    GList *curr = list;
    while (curr->next) curr = curr->next;
    curr->next = new_node;
    new_node->prev = curr;
    return list;
}

static inline GList* g_list_prepend(GList *list, gpointer data) {
    GList *new_node = g_new0(GList, 1);
    new_node->data = data;
    new_node->next = list;
    if (list) list->prev = new_node;
    return new_node;
}

static inline GList* g_list_remove(GList *list, gconstpointer data) {
    GList *curr = list;
    while (curr) {
        if (curr->data == data) {
            if (curr->prev) curr->prev->next = curr->next;
            if (curr->next) curr->next->prev = curr->prev;
            GList *head = (curr == list) ? curr->next : list;
            g_free(curr);
            return head;
        }
        curr = curr->next;
    }
    return list;
}

static inline void g_list_free(GList *list) {
    while (list) {
        GList *next = list->next;
        g_free(list);
        list = next;
    }
}

/* GPtrArray */
typedef struct {
    gpointer *pdata;
    guint len;
    guint allocated_len;
    GDestroyNotify element_free_func;
} GPtrArray;

static inline GPtrArray* g_ptr_array_new(void) {
    GPtrArray *a = g_new0(GPtrArray, 1);
    a->allocated_len = 16;
    a->pdata = (gpointer*)g_malloc0(sizeof(gpointer) * a->allocated_len);
    return a;
}

static inline GPtrArray* g_ptr_array_new_with_free_func(GDestroyNotify element_free_func) {
    GPtrArray *a = g_ptr_array_new();
    a->element_free_func = element_free_func;
    return a;
}

static inline void g_ptr_array_add(GPtrArray *array, gpointer data) {
    if (array->len >= array->allocated_len) {
        array->allocated_len = (array->allocated_len < 16) ? 16 : array->allocated_len * 2;
        array->pdata = (gpointer*)g_realloc(array->pdata, sizeof(gpointer) * array->allocated_len);
    }
    array->pdata[array->len++] = data;
}

static inline gpointer g_ptr_array_index(GPtrArray *array, guint index) {
    if (!array || index >= array->len) return NULL;
    return array->pdata[index];
}

static inline gpointer* g_ptr_array_free(GPtrArray *array, gboolean free_seg) {
    if (!array) return NULL;
    if (array->element_free_func) {
        for (guint i = 0; i < array->len; i++) {
            if (array->pdata[i]) array->element_free_func(array->pdata[i]);
        }
    }
    gpointer *pdata = array->pdata;
    if (free_seg) {
        g_free(array->pdata);
        pdata = NULL;
    }
    g_free(array);
    return pdata;
}

/* GByteArray */
typedef struct {
    guint8 *data;
    guint len;
    guint allocated_len;
} GByteArray;

static inline GByteArray* g_byte_array_new(void) {
    GByteArray *a = g_new0(GByteArray, 1);
    a->allocated_len = 64;
    a->data = (guint8*)g_malloc0(a->allocated_len);
    return a;
}

static inline GByteArray* g_byte_array_append(GByteArray *array, const guint8 *data, guint len) {
    if (array->len + len > array->allocated_len) {
        array->allocated_len = (array->len + len) * 2;
        array->data = (guint8*)g_realloc(array->data, array->allocated_len);
    }
    memcpy(array->data + array->len, data, len);
    array->len += len;
    return array;
}

static inline guint8* g_byte_array_free(GByteArray *array, gboolean free_segment) {
    if (!array) return NULL;
    guint8 *data = array->data;
    if (free_segment) {
        g_free(array->data);
        data = NULL;
    }
    g_free(array);
    return data;
}

/* Monotonic Time and Sleep */
#define G_TIME_SPAN_SECOND      1000000LL
#define G_TIME_SPAN_MILLISECOND 1000LL

static inline gint64 g_get_monotonic_time(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ((gint64)ts.tv_sec * 1000000LL) + (ts.tv_nsec / 1000LL);
}

static inline void g_usleep(gulong microseconds) {
    usleep((useconds_t)microseconds);
}

/* Path and File Utilities */
#define G_FILE_TEST_EXISTS (1 << 0)
#define G_FILE_TEST_IS_REGULAR (1 << 1)
#define G_FILE_TEST_IS_DIR (1 << 2)
typedef int GFileTest;
typedef struct stat GStatBuf;
#define g_stat(path, buf) stat(path, buf)
#define g_mkdir(path, mode) mkdir(path, mode)

static inline gboolean g_file_test(const gchar *filename, GFileTest test) {
    if (!filename) return FALSE;
    struct stat st;
    if (stat(filename, &st) != 0) return FALSE;
    if ((test & G_FILE_TEST_IS_DIR) && S_ISDIR(st.st_mode)) return TRUE;
    if ((test & G_FILE_TEST_IS_REGULAR) && S_ISREG(st.st_mode)) return TRUE;
    if (test & G_FILE_TEST_EXISTS) return TRUE;
    return FALSE;
}

static inline int g_access(const gchar *filename, int mode) {
    return access(filename, mode);
}

static inline FILE* g_fopen(const gchar *filename, const gchar *mode) {
    return fopen(filename, mode);
}

static inline int g_rename(const gchar *oldfilename, const gchar *newfilename) {
    return rename(oldfilename, newfilename);
}

static inline int g_remove(const gchar *filename) {
    return remove(filename);
}

static inline int g_unlink(const gchar *filename) {
    return unlink(filename);
}

static inline gchar* g_build_filename(const gchar *first_element, ...) {
    if (!first_element) return NULL;
    gchar buf[1024];
    strncpy(buf, first_element, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    
    va_list args;
    va_start(args, first_element);
    const gchar *next = va_arg(args, const gchar*);
    while (next) {
        size_t blen = strlen(buf);
        if (blen > 0 && buf[blen - 1] != '/' && blen < sizeof(buf) - 2) {
            buf[blen++] = '/';
            buf[blen] = '\0';
        }
        strncat(buf, next, sizeof(buf) - blen - 1);
        next = va_arg(args, const gchar*);
    }
    va_end(args);
    return g_strdup(buf);
}

static inline gchar* g_path_get_basename(const gchar *file_name) {
    if (!file_name) return NULL;
    const char *last = strrchr(file_name, '/');
    return g_strdup(last ? last + 1 : file_name);
}

static inline gchar* g_path_get_dirname(const gchar *file_name) {
    if (!file_name) return NULL;
    const char *last = strrchr(file_name, '/');
    if (!last) return g_strdup(".");
    if (last == file_name) return g_strdup("/");
    int len = (int)(last - file_name);
    gchar *res = (gchar*)g_malloc(len + 1);
    memcpy(res, file_name, len);
    res[len] = '\0';
    return res;
}

static inline gboolean g_path_is_absolute(const gchar *file_name) {
    if (!file_name) return FALSE;
    return file_name[0] == '/';
}

static inline gchar* g_get_current_dir(void) {
    char buf[1024];
    if (getcwd(buf, sizeof(buf))) {
        return g_strdup(buf);
    }
    return g_strdup("/");
}

/* Single-Threaded Synchronization Shims (No-op) */
typedef struct { int lock; } GMutex;
typedef struct { int cond; } GCond;
typedef struct { int rwlock; } GRWLock;

static inline void g_mutex_init(GMutex *m) { if (m) m->lock = 0; }
static inline void g_mutex_clear(GMutex *m) { (void)m; }
static inline void g_mutex_lock(GMutex *m) { if (m) m->lock = 1; }
static inline gboolean g_mutex_trylock(GMutex *m) { if (m) m->lock = 1; return TRUE; }
static inline void g_mutex_unlock(GMutex *m) { if (m) m->lock = 0; }

static inline void g_cond_init(GCond *c) { (void)c; }
static inline void g_cond_clear(GCond *c) { (void)c; }
static inline void g_cond_signal(GCond *c) { (void)c; }
static inline void g_cond_broadcast(GCond *c) { (void)c; }
static inline void g_cond_wait(GCond *c, GMutex *m) { (void)c; (void)m; }
static inline gboolean g_cond_wait_until(GCond *c, GMutex *m, gint64 end_time) {
    (void)c; (void)m; (void)end_time; return TRUE;
}

static inline void g_rw_lock_init(GRWLock *l) { (void)l; }
static inline void g_rw_lock_clear(GRWLock *l) { (void)l; }
static inline void g_rw_lock_writer_lock(GRWLock *l) { (void)l; }
static inline void g_rw_lock_writer_unlock(GRWLock *l) { (void)l; }
static inline void g_rw_lock_reader_lock(GRWLock *l) { (void)l; }
static inline void g_rw_lock_reader_unlock(GRWLock *l) { (void)l; }

/* Error Reporting Shims */
typedef struct {
    uint32_t domain;
    int code;
    char *message;
} GError;

static inline void g_error_free(GError *error) {
    if (error) {
        if (error->message) free(error->message);
        free(error);
    }
}

static inline void g_clear_error(GError **error) {
    if (error && *error) {
        g_error_free(*error);
        *error = NULL;
    }
}

/* Locale / UTF-8 Conversion Shims */
static inline gchar* g_locale_from_utf8(const gchar *utf8string, gssize len, gsize *bytes_read, gsize *bytes_written, GError **error) {
    (void)error;
    if (!utf8string) return NULL;
    if (len < 0) len = strlen(utf8string);
    if (bytes_read) *bytes_read = len;
    if (bytes_written) *bytes_written = len;
    gchar *res = (gchar*)malloc(len + 1);
    if (res) {
        memcpy(res, utf8string, len);
        res[len] = '\0';
    }
    return res;
}

static inline gchar* g_locale_to_utf8(const gchar *opsysstring, gssize len, gsize *bytes_read, gsize *bytes_written, GError **error) {
    return g_locale_from_utf8(opsysstring, len, bytes_read, bytes_written, error);
}

static inline gunichar2* g_utf8_to_utf16(const gchar *str, gssize len, glong *items_read, glong *items_written, GError **error) {
    (void)error;
    if (!str) return NULL;
    if (len < 0) len = (gssize)strlen(str);
    if (items_read) *items_read = len;
    if (items_written) *items_written = len;
    gunichar2 *res = (gunichar2*)malloc(sizeof(gunichar2) * (len + 1));
    if (res) {
        for (gssize i = 0; i < len; i++) {
            res[i] = (gunichar2)(unsigned char)str[i];
        }
        res[len] = 0;
    }
    return res;
}

static inline gchar* g_utf16_to_utf8(const gunichar2 *str, glong len, glong *items_read, glong *items_written, GError **error) {
    (void)error;
    if (!str) return NULL;
    if (len < 0) {
        len = 0;
        while (str[len]) len++;
    }
    if (items_read) *items_read = len;
    if (items_written) *items_written = len;
    gchar *res = (gchar*)malloc(len + 1);
    if (res) {
        for (glong i = 0; i < len; i++) {
            res[i] = (gchar)(str[i] & 0x7F);
        }
        res[len] = '\0';
    }
    return res;
}

/* Directory Iteration Shims */
typedef struct {
    void *dir_handle;
} GDir;

static inline GDir* g_dir_open(const gchar *path, guint flags, GError **error) {
    (void)path; (void)flags; (void)error;
    return NULL;
}

static inline const gchar* g_dir_read_name(GDir *dir) {
    (void)dir;
    return NULL;
}

static inline void g_dir_close(GDir *dir) {
    (void)dir;
}

/* Hash table, timer, thread forward declarations & stubs */
typedef struct GHashTable GHashTable;
typedef struct GTimer GTimer;
typedef struct GThread GThread;

#ifndef g_assert
#define g_assert(expr) do { if (!(expr)) { fprintf(stderr, "Assertion failed: %s\n", #expr); abort(); } } while(0)
#endif

static inline int g_mkdir_with_parents(const gchar *pathname, int mode) {
    (void)mode;
    if (!pathname) return -1;
    char tmp[1024];
    char *p = NULL;
    size_t len = strlen(pathname);
    if (len >= sizeof(tmp)) return -1;
    strcpy(tmp, pathname);
    for (p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = '\0';
            mkdir(tmp, 0755);
            *p = '/';
        }
    }
    return mkdir(tmp, 0755);
}

typedef struct GTimeZone GTimeZone;
typedef struct GDateTime {
    struct tm tm_info;
} GDateTime;

static inline GTimeZone* g_time_zone_new_local(void) {
    return (GTimeZone*)0x1;
}

static inline void g_time_zone_unref(GTimeZone *tz) {
    (void)tz;
}

static inline GDateTime* g_date_time_new_now(GTimeZone *tz) {
    (void)tz;
    GDateTime *dt = g_new0(GDateTime, 1);
    time_t t = time(NULL);
    struct tm *local = localtime(&t);
    if (local) dt->tm_info = *local;
    return dt;
}

static inline gint g_date_time_get_year(GDateTime *datetime) {
    return datetime ? (datetime->tm_info.tm_year + 1900) : 2026;
}

static inline gint g_date_time_get_month(GDateTime *datetime) {
    return datetime ? (datetime->tm_info.tm_mon + 1) : 1;
}

static inline gint g_date_time_get_day_of_month(GDateTime *datetime) {
    return datetime ? datetime->tm_info.tm_mday : 1;
}

static inline gint g_date_time_get_hour(GDateTime *datetime) {
    return datetime ? datetime->tm_info.tm_hour : 0;
}

static inline gint g_date_time_get_minute(GDateTime *datetime) {
    return datetime ? datetime->tm_info.tm_min : 0;
}

static inline gint g_date_time_get_second(GDateTime *datetime) {
    return datetime ? datetime->tm_info.tm_sec : 0;
}

static inline void g_date_time_unref(GDateTime *datetime) {
    if (datetime) g_free(datetime);
}


#ifdef __cplusplus
}
#endif

#endif /* GLIB_SHIM_H */

